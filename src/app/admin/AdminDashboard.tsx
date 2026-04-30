"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAdminMode,
  resetDailyProgress,
  loadAdminConfig,
  saveAdminConfig,
  adminHeaders,
  type AdminConfig,
  type OverrideTrack,
} from "@/lib/admin";
import { SimulatorPanel } from "@/app/admin/SimulatorPanel";
import {
  DAILY_POOL,
  dayKeyFor,
  pickTrackForDay,
  type PoolTrack,
} from "@/lib/daily/pick";
import type { RiffleTrack } from "@/lib/itunes";
import { useAudioStore } from "@/lib/store/audio";
import nowTracklists from "@/lib/daily/now-tracklists.json";

type WikiVolume = {
  vol: number;
  year: number;
  tracks: { title: string; artist: string; fullArtist: string }[];
};
type WikiFile = { volumes: WikiVolume[] };
const WIKI_VOLUMES = new Map<number, WikiVolume>();
for (const v of (nowTracklists as WikiFile).volumes) WIKI_VOLUMES.set(v.vol, v);

type UpcomingRow = {
  day: string;
  dayKey: string;
  pick: PoolTrack | null;
  override: OverrideTrack | null;
};

function poolToOverride(t: PoolTrack): OverrideTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    albumArtUrl: t.albumArtUrl,
    previewUrl: t.previewUrl,
    durationMs: t.durationMs,
    releaseYear: t.releaseYear,
  };
}

function riffleToOverride(t: RiffleTrack): OverrideTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    albumArtUrl: t.albumArtUrl,
    previewUrl: t.previewUrl,
    durationMs: t.durationMs,
    releaseYear: t.releaseYear ?? null,
  };
}

export function AdminDashboard() {
  const [on] = useAdminMode();
  const [config, setConfig] = useState<AdminConfig>(() => loadAdminConfig());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerTab, setPickerTab] = useState<"now" | "search" | "pool">(
    "now",
  );
  const [syncing, setSyncing] = useState(false);

  // Load overrides from Supabase on mount so the admin sees what's
  // actually live, not stale localStorage.
  useEffect(() => {
    if (!on) return;
    (async () => {
      try {
        const res = await fetch("/api/daily/overrides");
        if (!res.ok) return;
        const json = (await res.json()) as {
          overrides: {
            day_key: string;
            track_id: string;
            title: string;
            artist: string;
            album: string;
            album_art_url: string;
            preview_url: string;
            duration_ms: number;
            release_year: number | null;
          }[];
        };
        const overrides: Record<string, OverrideTrack> = {};
        for (const row of json.overrides) {
          overrides[row.day_key] = {
            id: row.track_id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            albumArtUrl: row.album_art_url,
            previewUrl: row.preview_url,
            durationMs: row.duration_ms,
            releaseYear: row.release_year,
          };
        }
        setConfig((prev) => {
          const next = { ...prev, overrides };
          saveAdminConfig(next);
          return next;
        });
      } catch {}
    })();
  }, [on]);

  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  useEffect(() => {
    const rows: UpcomingRow[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() + i * 86_400_000);
      const dayKey = dayKeyFor(d, config.rolloverHourUtc);
      const override = config.overrides[dayKey] ?? null;
      rows.push({
        day: d.toDateString(),
        dayKey,
        pick: pickTrackForDay(dayKey),
        override,
      });
    }
    setUpcoming(rows);
  }, [config]);

  function updateConfig(patch: Partial<AdminConfig>) {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAdminConfig(next);

    // If overrides changed, sync to Supabase so all users see them.
    if (patch.overrides) {
      setSyncing(true);
      // Build a diff: new/changed overrides + deleted keys (null).
      const body: Record<string, OverrideTrack | null> = {};
      for (const [key, val] of Object.entries(patch.overrides)) {
        body[key] = val;
      }
      // Keys that were in old config but not in new = deleted.
      for (const key of Object.keys(config.overrides)) {
        if (!(key in patch.overrides)) body[key] = null;
      }
      fetch("/api/daily/overrides", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ overrides: body }),
      })
        .catch(() => {})
        .finally(() => setSyncing(false));
    }
  }

  // Filter state for the pool used by shuffle / auto-fill.
  const [filterDecade, setFilterDecade] = useState<string>("");
  const [filterArtist, setFilterArtist] = useState<string>("");
  const [filterAlbum, setFilterAlbum] = useState<string>("");

  const poolAlbums = useMemo(() => {
    const set = new Set<string>();
    for (const t of DAILY_POOL) if (t.album) set.add(t.album);
    return [...set].sort();
  }, []);

  const filteredPool = useMemo(() => {
    const a = filterArtist.toLowerCase();
    return DAILY_POOL.filter((t) => {
      if (filterDecade) {
        const decade = Math.floor((t.releaseYear ?? 0) / 10) * 10;
        if (String(decade) !== filterDecade) return false;
      }
      if (a && !t.artist.toLowerCase().includes(a)) return false;
      if (filterAlbum && t.album !== filterAlbum) return false;
      return true;
    });
  }, [filterDecade, filterArtist, filterAlbum]);

  const hasFilter = Boolean(filterDecade || filterArtist || filterAlbum);

  function pinToSelected(track: OverrideTrack) {
    // Check for duplicates: has this song already been scheduled?
    const existingDates: string[] = [];
    for (const [dayKey, ov] of Object.entries(config.overrides)) {
      if (ov.id === track.id) {
        // Convert dayKey "YYYY-M-D" back to readable date.
        const [y, m, d] = dayKey.split("-").map(Number);
        const date = new Date(Date.UTC(y, m, d));
        existingDates.push(date.toDateString());
      }
    }
    if (existingDates.length > 0) {
      const dateList =
        existingDates.length > 5
          ? existingDates.slice(0, 5).join("\n  ") +
            `\n  ...and ${existingDates.length - 5} more`
          : existingDates.join("\n  ");
      const ok = window.confirm(
        `"${track.title}" by ${track.artist} is already scheduled on:\n  ${dateList}\n\nAre you sure you want to add it again?`,
      );
      if (!ok) return;
    }

    const overrides = { ...config.overrides };
    const targets =
      selected.size > 0
        ? [...selected]
        : [dayKeyFor(new Date(), config.rolloverHourUtc)];
    for (const dayKey of targets) overrides[dayKey] = track;
    updateConfig({ overrides });
  }

  function toggleOne(dayKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  }

  // Pick N unique random tracks from the (optionally filtered) pool,
  // avoiding songs that are already assigned to other upcoming days.
  function pickRandom(count: number, existingIds: Set<string>): OverrideTrack[] {
    const source = hasFilter ? filteredPool : DAILY_POOL;
    const available = source.filter((t) => !existingIds.has(t.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(poolToOverride);
  }

  function shuffleSelected() {
    const targets =
      selected.size > 0
        ? [...selected]
        : upcoming.map((r) => r.dayKey);
    const overrides = { ...config.overrides };
    // Collect IDs of days we're NOT shuffling to avoid duplicates.
    const kept = new Set<string>();
    for (const row of upcoming) {
      if (targets.includes(row.dayKey)) continue;
      const shown = overrides[row.dayKey] ?? row.pick;
      if (shown) kept.add(shown.id);
    }
    const picks = pickRandom(targets.length, kept);
    for (let i = 0; i < targets.length; i++) {
      if (picks[i]) {
        overrides[targets[i]] = picks[i];
        kept.add(picks[i].id);
      }
    }
    updateConfig({ overrides });
  }

  const allSelected =
    upcoming.length > 0 && selected.size === upcoming.length;

  if (!on) {
    return (
      <div className="w-full max-w-3xl rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-center text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="text-xl font-black">Admin mode is off</div>
        <p className="mt-2 text-sm text-stone-600">
          Type{" "}
          <span className="rounded bg-amber-200 px-1 font-mono">
            riffleadmin
          </span>{" "}
          on your keyboard, or tap the logo 7 times on mobile, to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5">
      <SimulatorPanel />
      {/* Top row: settings */}
      <div className="grid w-full gap-5 md:grid-cols-2">
        <Card title="Pool source">
          <div className="rounded-xl bg-stone-100 p-3 font-mono text-sm">
            {DAILY_POOL.length} tracks from NOW That&rsquo;s What I Call
            Music
          </div>
        </Card>
        <Card title="Daily rollover (UTC hour)">
          <label className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-stone-600">
              Hour
            </span>
            <input
              type="number"
              min={0}
              max={23}
              value={config.rolloverHourUtc}
              onChange={(e) =>
                updateConfig({
                  rolloverHourUtc: Math.max(
                    0,
                    Math.min(23, Number(e.target.value) || 0),
                  ),
                })
              }
              className="w-20 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono"
            />
          </label>
        </Card>
      </div>

      <AdminSecretEditor />

      {/* Main editor: upcoming + picker side-by-side */}
      <div className="grid w-full items-start gap-5 md:grid-cols-2">
        {/* LEFT: upcoming dailies */}
        <Card title={`Upcoming · ${selected.size} selected${syncing ? " · Saving…" : ""}`}>
          {/* Filter bar */}
          <div className="mb-3 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-stone-400">
              Filter pool for shuffle / auto-fill
              {hasFilter && (
                <span className="ml-1 text-amber-600">
                  ({filteredPool.length} tracks match)
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterDecade}
                onChange={(e) => setFilterDecade(e.target.value)}
                className="rounded-full border-2 border-stone-300 bg-stone-50 px-3 py-1 text-xs font-black"
              >
                <option value="">Any decade</option>
                <option value="2020">2020s</option>
                <option value="2010">2010s</option>
                <option value="2000">2000s</option>
                <option value="1990">90s</option>
              </select>
              <select
                value={filterAlbum}
                onChange={(e) => setFilterAlbum(e.target.value)}
                className="min-w-0 flex-1 truncate rounded-full border-2 border-stone-300 bg-stone-50 px-3 py-1 text-xs font-black"
              >
                <option value="">Any album</option>
                {poolAlbums.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filterArtist}
                onChange={(e) => setFilterArtist(e.target.value)}
                placeholder="Artist…"
                className="min-w-[6rem] flex-1 rounded-full border-2 border-stone-300 bg-stone-50 px-3 py-1 text-xs font-black"
              />
              {hasFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterDecade("");
                    setFilterArtist("");
                    setFilterAlbum("");
                  }}
                  className="rounded-full border-2 border-stone-300 bg-stone-50 px-3 py-1 text-xs font-black text-stone-600"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={
                allSelected
                  ? () => setSelected(new Set())
                  : () =>
                      setSelected(new Set(upcoming.map((r) => r.dayKey)))
              }
              className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={shuffleSelected}
              className="rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
            >
              {selected.size > 0
                ? `Shuffle ${selected.size}`
                : "Shuffle all"}
            </button>
            {selected.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const overrides = { ...config.overrides };
                    for (const key of selected) delete overrides[key];
                    updateConfig({ overrides });
                  }}
                  className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1"
                >
                  Revert
                </button>
              </>
            )}
          </div>

          {/* Day list */}
          <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {upcoming.map((row) => {
              const shown = row.override ?? row.pick;
              const isSel = selected.has(row.dayKey);
              return (
                <li key={row.dayKey}>
                  <button
                    type="button"
                    onClick={() => toggleOne(row.dayKey)}
                    className={
                      isSel
                        ? "flex w-full items-start gap-3 rounded-xl border-2 border-amber-500 bg-amber-100 px-3 py-2 text-left text-sm"
                        : "flex w-full items-start gap-3 rounded-xl bg-stone-100 px-3 py-2 text-left text-sm hover:bg-amber-50"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      readOnly
                      className="mt-1 h-4 w-4 accent-amber-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-black">{row.day}</div>
                      <div className="truncate text-stone-600">
                        {shown
                          ? `${shown.title} · ${shown.artist}`
                          : "-"}
                        {row.override && (
                          <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] uppercase">
                            Override
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* RIGHT: song picker */}
        <Card
          title={
            selected.size > 0
              ? `Pick a song · pin to ${selected.size} day${selected.size === 1 ? "" : "s"}`
              : "Pick a song · pin to today"
          }
        >
          {/* Tabs */}
          <div className="mb-3 flex gap-1 rounded-full bg-stone-100 p-1">
            {(
              [
                { key: "now", label: "NOW Albums" },
                { key: "search", label: "Search anything" },
                { key: "pool", label: "Current pool" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPickerTab(tab.key)}
                className={
                  pickerTab === tab.key
                    ? "flex-1 rounded-full bg-amber-400 py-1.5 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
                    : "flex-1 rounded-full py-1.5 text-xs font-black text-stone-600 hover:text-stone-900"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          {pickerTab === "now" && (
            <NowAlbumsPicker onPin={pinToSelected} allOverrides={config.overrides} />
          )}
          {pickerTab === "search" && (
            <FreeSearchPicker onPin={pinToSelected} />
          )}
          {pickerTab === "pool" && (
            <PoolPicker onPin={pinToSelected} />
          )}
        </Card>
      </div>

      {/* Maintenance */}
      <Card title="Maintenance">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetDailyProgress();
              alert(
                "Daily progress cleared. Refresh /daily to play again.",
              );
            }}
            className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-black shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
          >
            Reset my daily progress
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("Clear all admin overrides?")) return;
              const cfg = loadAdminConfig();
              saveAdminConfig({ ...cfg, overrides: {} });
              setConfig({ ...cfg, overrides: {} });
            }}
            className="rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 text-sm font-black shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
          >
            Clear all overrides
          </button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NOW Albums tab: type a volume number, see its tracks from iTunes
// ---------------------------------------------------------------------------
// NOW That's What I Call Music volumes. The UK series runs 1–122+ and the
// US series 1–93. We list every volume number up to 125 so both series
// are browsable from the same dropdown, iTunes will return whichever
// edition is available in the user's store region.
// Volumes available via Spotify/iTunes (streaming, recent only).
const STREAMING_AVAILABLE = new Set([89, 107, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122]);
const NOW_VOLUMES: number[] = [];
for (let v = 1; v <= 122; v++) NOW_VOLUMES.push(v);
function volSource(v: number): "wiki" | "streaming" | "none" {
  if (WIKI_VOLUMES.has(v)) return "wiki";
  if (STREAMING_AVAILABLE.has(v)) return "streaming";
  return "none";
}

function NowAlbumsPicker({
  onPin,
  allOverrides,
}: {
  onPin: (t: OverrideTrack) => void;
  allOverrides: Record<string, OverrideTrack>;
}) {
  const [selectedVol, setSelectedVol] = useState<string>("");
  const [tracks, setTracks] = useState<RiffleTrack[]>([]);
  const [wikiTracks, setWikiTracks] = useState<WikiVolume["tracks"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [albumName, setAlbumName] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedVol) {
      setTracks([]);
      setWikiTracks(null);
      setAlbumName(null);
      return;
    }
    const vol = Number(selectedVol);
    const wiki = WIKI_VOLUMES.get(vol);
    if (wiki) {
      // Serve from static Wikipedia data, instant, no API calls.
      setWikiTracks(wiki.tracks);
      setAlbumName(`NOW That's What I Call Music! ${vol} (${wiki.year})`);
      setTracks([]);
      setLoading(false);
      return;
    }
    // Fall back to Spotify+iTunes API for streaming-only volumes.
    setWikiTracks(null);
    let cancelled = false;
    setLoading(true);
    const term = `Now That's What I Call Music ${selectedVol}`;
    fetch(`/api/itunes/album-tracks?q=${encodeURIComponent(term)}`)
      .then((res) => (res.ok ? res.json() : { tracks: [], albumName: null }))
      .then(
        (json: { tracks: RiffleTrack[]; albumName?: string | null }) => {
          if (cancelled) return;
          setTracks(json.tracks);
          setAlbumName(json.albumName ?? null);
        },
      )
      .catch(() => {
        if (!cancelled) {
          setTracks([]);
          setAlbumName(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVol]);

  const src = selectedVol ? volSource(Number(selectedVol)) : null;

  return (
    <>
      <select
        value={selectedVol}
        onChange={(e) => setSelectedVol(e.target.value)}
        className="w-full rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 font-black"
      >
        <option value="">Select a NOW album…</option>
        {NOW_VOLUMES.map((vol) => {
          const s = volSource(vol);
          const wv = WIKI_VOLUMES.get(vol);
          const tag =
            s === "wiki"
              ? ""
              : s === "streaming"
                ? " · streaming"
                : " · unavailable";
          return (
            <option key={vol} value={String(vol)}>
              NOW {vol}
              {wv ? ` (${wv.year})` : ""}
              {tag}
            </option>
          );
        })}
      </select>
      {loading && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-stone-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          Loading tracks (this can take up to a minute)…
        </div>
      )}
      {albumName && !loading && (
        <div className="mt-2 text-xs text-stone-500">
          <span className="font-black">{albumName}</span> ·{" "}
          {wikiTracks ? wikiTracks.length : tracks.length} track
          {(wikiTracks ? wikiTracks.length : tracks.length) === 1
            ? ""
            : "s"}
          {wikiTracks && (
            <span className="ml-1 text-stone-400">
              (from Wikipedia, iTunes lookup on pin)
            </span>
          )}
        </div>
      )}
      {selectedVol && !loading && src === "none" && (
        <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-stone-700">
          <div className="font-black">
            NOW {selectedVol}, no tracklist available
          </div>
          <p className="mt-1 text-xs text-stone-500">
            This volume doesn&rsquo;t have a Wikipedia page or streaming
            listing. Use the{" "}
            <span className="font-black">Search anything</span> tab to
            find individual songs.
          </p>
        </div>
      )}
      {/* Wikipedia/Fandom tracks with preview + pin */}
      {wikiTracks && wikiTracks.length > 0 && (
        <WikiTrackList
          tracks={wikiTracks}
          onPin={(t) => onPin(riffleToOverride(t))}
          allOverrides={allOverrides}
        />
      )}
      {/* Streaming tracks (Spotify+iTunes resolved) */}
      {!wikiTracks && (
        <TrackList
          tracks={tracks}
          empty={
            selectedVol
              ? loading
                ? ""
                : albumName
                  ? "This album has no playable tracks."
                  : ""
              : "Select a NOW album above to see its tracks."
          }
          onPin={(t) => onPin(riffleToOverride(t))}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Free search tab: search iTunes for anything
// ---------------------------------------------------------------------------
function FreeSearchPicker({
  onPin,
}: {
  onPin: (t: OverrideTrack) => void;
}) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<RiffleTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/itunes/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as { tracks: RiffleTrack[] };
      setTracks(json.tracks);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Song title, artist, album…"
          className="min-w-0 flex-1 rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 font-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="whitespace-nowrap rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-black shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>
      <TrackList
        tracks={tracks}
        empty={
          searched && !loading
            ? "No matches."
            : "Type a query and hit Search."
        }
        onPin={(t) => onPin(riffleToOverride(t))}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Pool tab: browse the static now-pool.json by album or text search
// ---------------------------------------------------------------------------
function PoolPicker({
  onPin,
}: {
  onPin: (t: OverrideTrack) => void;
}) {
  const [query, setQuery] = useState("");
  const [albumFilter, setAlbumFilter] = useState<string>("");

  const albums = useMemo(() => {
    const set = new Set<string>();
    for (const t of DAILY_POOL) if (t.album) set.add(t.album);
    return [...set].sort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DAILY_POOL.filter((t) => {
      if (albumFilter && t.album !== albumFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
      );
    }).slice(0, 200);
  }, [query, albumFilter]);

  // Map pool tracks into RiffleTrack shape so TrackList can render them.
  const asTracks: RiffleTrack[] = useMemo(
    () =>
      filtered.map((t) => ({
        id: t.id,
        source: "itunes" as const,
        title: t.title,
        artist: t.artist,
        album: t.album,
        albumArtUrl: t.albumArtUrl,
        previewUrl: t.previewUrl,
        durationMs: t.durationMs,
        releaseYear: t.releaseYear ?? undefined,
      })),
    [filtered],
  );

  return (
    <>
      <select
        value={albumFilter}
        onChange={(e) => setAlbumFilter(e.target.value)}
        className="mb-2 w-full rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 font-black"
      >
        <option value="">All albums ({DAILY_POOL.length} tracks)</option>
        {albums.map((a) => (
          <option key={a} value={a}>
            {a} ({DAILY_POOL.filter((t) => t.album === a).length})
          </option>
        ))}
      </select>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by title, artist, or album…"
        className="mb-2 w-full rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 font-black"
      />
      <TrackList
        tracks={asTracks}
        empty="No matches."
        onPin={(t) => onPin(riffleToOverride(t))}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared track list used by all three tabs
// ---------------------------------------------------------------------------
function TrackList({
  tracks,
  empty,
  onPin,
}: {
  tracks: RiffleTrack[];
  empty: string;
  onPin: (t: RiffleTrack) => void;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const registerAudio = useAudioStore((s) => s.registerAudio);

  function togglePreview(t: RiffleTrack) {
    if (playingId === t.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(
      `/api/audio/${t.id}?src=${encodeURIComponent(t.previewUrl)}`,
    );
    a.addEventListener("ended", () => setPlayingId(null));
    a.play().catch(() => {});
    // undefined maxSeconds = admin preview plays the full clip (no cap).
    registerAudio(a, "/admin", undefined, t.title, t.artist);
    audioRef.current = a;
    setPlayingId(t.id);
  }

  // Pause on unmount or when track list changes.
  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [tracks],
  );

  return (
    <ul className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border-2 border-stone-200">
      {tracks.length === 0 && (
        <li className="px-3 py-6 text-center text-sm text-stone-500">
          {empty}
        </li>
      )}
      {tracks.map((t) => {
        const isPlaying = playingId === t.id;
        return (
          <li
            key={t.id}
            className="flex items-center gap-1 border-b border-stone-100 last:border-b-0"
          >
            {/* Preview button */}
            <button
              type="button"
              onClick={() => togglePreview(t)}
              aria-label={isPlaying ? "Pause preview" : "Preview"}
              className={
                isPlaying
                  ? "ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-stone-900"
                  : "ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600 hover:bg-amber-200"
              }
            >
              {isPlaying ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <rect x="5" y="4" width="3" height="12" rx="1" />
                  <rect x="12" y="4" width="3" height="12" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.5 4.5v11l9-5.5z" />
                </svg>
              )}
            </button>
            {/* Track info + pin */}
            <button
              type="button"
              onClick={() => onPin(t)}
              className="flex min-w-0 flex-1 items-start justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-amber-100"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black">
                  {t.title}
                </span>
                <span className="block truncate text-stone-500">
                  {t.artist}
                </span>
                {t.album && (
                  <span className="block truncate text-xs text-stone-400">
                    {t.album}
                  </span>
                )}
              </span>
              <span className="mt-1 whitespace-nowrap rounded-full border-2 border-stone-900 bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase">
                Pin
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Wiki track list: shows songs from the Fandom wiki with preview + pin.
// Each row resolves its iTunes preview lazily (on first preview or pin).
// ---------------------------------------------------------------------------
function WikiTrackList({
  tracks,
  onPin,
  allOverrides,
}: {
  tracks: WikiVolume["tracks"];
  onPin: (t: RiffleTrack) => void;
  allOverrides: Record<string, OverrideTrack>;
}) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, RiffleTrack | null>>(new Map());
  const registerAudio = useAudioStore((s) => s.registerAudio);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [tracks],
  );

  async function resolveTrack(
    title: string,
    artist: string,
  ): Promise<RiffleTrack | null> {
    const key = `${title}::${artist}`.toLowerCase();
    if (cacheRef.current.has(key)) return cacheRef.current.get(key)!;
    const lc = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    // Strip common suffixes that trip up iTunes search.
    const cleanTitle = title
      .replace(/\s*\((?:Edit|Live|Remix|Radio Edit|Mixed|feat\.?[^)]*)\)/gi, "")
      .trim();
    // Try multiple queries: full → cleaned title + artist → just title.
    const queries = [
      `${title} ${artist}`,
      `${cleanTitle} ${artist}`,
      cleanTitle,
    ];
    for (const q of queries) {
      const res = await fetch(
        `/api/itunes/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as { tracks: RiffleTrack[] };
      if (!json.tracks?.length) continue;
      const lt = lc(cleanTitle);
      const la = lc(artist).split(" ")[0];
      const match =
        json.tracks.find((t) => {
          const rt = lc(t.title);
          const ra = lc(t.artist);
          return (rt.includes(lt) || lt.includes(rt)) && ra.includes(la);
        }) ?? json.tracks[0];
      if (match) {
        cacheRef.current.set(key, match);
        return match;
      }
    }
    cacheRef.current.set(key, null);
    return null;
  }

  async function togglePreview(idx: number) {
    if (playingIdx === idx) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }
    audioRef.current?.pause();
    const t = tracks[idx];
    setResolving(idx);
    const resolved = await resolveTrack(t.title, t.artist);
    setResolving(null);
    if (!resolved) {
      setFailedSet((prev) => new Set(prev).add(idx));
      return;
    }
    setFailedSet((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
    const a = new Audio(
      `/api/audio/${resolved.id}?src=${encodeURIComponent(resolved.previewUrl)}`,
    );
    a.addEventListener("ended", () => setPlayingIdx(null));
    a.play().catch(() => {});
    registerAudio(a, "/admin", undefined, resolved.title, resolved.artist);
    audioRef.current = a;
    setPlayingIdx(idx);
  }

  async function handlePin(idx: number) {
    const t = tracks[idx];
    setResolving(idx);
    const resolved = await resolveTrack(t.title, t.artist);
    setResolving(null);
    if (!resolved) return;

    // Check for duplicates before pinning.
    const existingDates: string[] = [];
    for (const [dayKey, ov] of Object.entries(allOverrides)) {
      if (ov.id === resolved.id) {
        const [y, m, d] = dayKey.split("-").map(Number);
        const date = new Date(Date.UTC(y, m, d));
        existingDates.push(date.toDateString());
      }
    }
    if (existingDates.length > 0) {
      const dateList =
        existingDates.length > 5
          ? existingDates.slice(0, 5).join("\n  ") +
            `\n  ...and ${existingDates.length - 5} more`
          : existingDates.join("\n  ");
      const ok = window.confirm(
        `"${resolved.title}" by ${resolved.artist} is already scheduled on:\n  ${dateList}\n\nAre you sure you want to add it again?`,
      );
      if (!ok) return;
    }

    onPin(resolved);
  }

  return (
    <ul className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border-2 border-stone-200">
      {tracks.map((t, i) => {
        const isPlaying = playingIdx === i;
        const isResolving = resolving === i;
        const isFailed = failedSet.has(i);
        return (
          <li
            key={`${t.title}-${i}`}
            className="flex items-center gap-1 border-b border-stone-100 last:border-b-0"
          >
            {/* Preview button */}
            <button
              type="button"
              onClick={() => togglePreview(i)}
              disabled={isResolving}
              aria-label={isFailed ? "Not on iTunes" : isPlaying ? "Pause preview" : "Preview"}
              title={isFailed ? "Not available on iTunes" : undefined}
              className={
                isFailed
                  ? "ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-200 text-rose-600"
                  : isPlaying
                    ? "ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-stone-900"
                    : "ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600 hover:bg-amber-200 disabled:opacity-50"
              }
            >
              {isResolving ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-stone-600 border-t-transparent" />
              ) : isFailed ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              ) : isPlaying ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <rect x="5" y="4" width="3" height="12" rx="1" />
                  <rect x="12" y="4" width="3" height="12" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.5 4.5v11l9-5.5z" />
                </svg>
              )}
            </button>
            {/* Track info + pin */}
            <button
              type="button"
              onClick={() => handlePin(i)}
              disabled={isResolving}
              className="flex min-w-0 flex-1 items-start justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-amber-100 disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black">{t.title}</span>
                <span className="block truncate text-stone-500">
                  {t.fullArtist || t.artist}
                </span>
              </span>
              <span className="mt-1 whitespace-nowrap rounded-full border-2 border-stone-900 bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase">
                Pin
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-stone-500">
        {title}
      </div>
      {children}
    </div>
  );
}

const ADMIN_SECRET_KEY = "riffle:admin:secret";

// Editor for the locally-stored admin secret. Lives on /admin so the
// dropdown stays clean. The secret value never leaves the browser —
// it's only sent as Authorization: Bearer <secret> on admin API calls.
function AdminSecretEditor() {
  const [stored, setStored] = useState("");
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(ADMIN_SECRET_KEY) ?? "";
    setStored(v);
    setDraft(v);
  }, []);

  function save() {
    if (typeof window === "undefined") return;
    if (!draft) {
      window.localStorage.removeItem(ADMIN_SECRET_KEY);
    } else {
      window.localStorage.setItem(ADMIN_SECRET_KEY, draft);
    }
    setStored(draft);
    setSavedJustNow(true);
    setTimeout(() => setSavedJustNow(false), 1800);
  }

  const dirty = draft !== stored;
  const masked = stored
    ? `${stored.slice(0, 4)}…${stored.slice(-4)} (${stored.length} chars)`
    : "Not set";

  return (
    <Card title="Admin secret">
      <div className="flex flex-col gap-2">
        <p className="text-xs text-stone-600">
          Sent as <code className="font-mono">Authorization: Bearer …</code>{" "}
          on every admin write API call. Must match the{" "}
          <code className="font-mono">ADMIN_SECRET</code> env var on Vercel.
          Stored only in this browser.
        </p>
        <div className="text-xs font-bold text-stone-700">
          Currently saved: <span className="font-mono">{masked}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type={show ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste secret here"
            className="min-w-0 flex-1 rounded-full border-2 border-stone-900 bg-stone-50 px-4 py-2 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((p) => !p)}
            className="rounded-full border-2 border-stone-900 bg-stone-100 px-3 py-2 text-xs font-black uppercase tracking-wider text-stone-900"
          >
            {show ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
          >
            {savedJustNow ? "Saved ✓" : dirty ? "Save" : "Up to date"}
          </button>
        </div>
      </div>
    </Card>
  );
}
