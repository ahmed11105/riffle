// Build the daily-guess song pool from the US "NOW That's What I Call
// Music!" compilation series.
//
// Strategy:
//   1. For each volume in the US series (1..95), fetch its Wikipedia page
//      wikitext, parse the infobox release year, skip if < 2000 or > 2026,
//      then parse the `{{Track listing}}` template for (title, artist).
//   2. For each parsed track, hit iTunes Search with "title artist" and
//      pick the best matching song that has a preview URL.
//   3. Dedupe by title+artist and write the pool to src/lib/daily/now-pool.json.
//
// Run with:  node scripts/fetch-now-pool.mjs

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/lib/daily/now-pool.json");
const CACHE = resolve(__dirname, ".now-itunes-cache.json");

const YEAR_MIN = 2000;
const YEAR_MAX = 2026;
const VOL_MIN = 1;
const VOL_MAX = 95;
const UA = "RiffRace/1.0 (https://github.com/uzair/riffrace) node-fetch";

async function wikitext(title) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.searchParams.set("action", "parse");
  u.searchParams.set("page", title);
  u.searchParams.set("prop", "wikitext");
  u.searchParams.set("format", "json");
  u.searchParams.set("formatversion", "2");
  const res = await fetch(u.toString(), { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.parse?.wikitext) return null;
  return String(json.parse.wikitext);
}

// Strip wikitext markup into plain text. Handles `[[Target|Label]]`,
// `[[Target]]`, italic/bold quotes, HTML refs, and trailing "featuring X"
// clauses we don't want in the canonical artist string.
function cleanWikiText(s) {
  if (!s) return "";
  return s
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryArtist(artistRaw) {
  // Collapse "A featuring B, C and D" → "A". We keep the lead performer as
  // the canonical artist so iTunes lookups match even when the NOW credit
  // list has a long featured-artist tail.
  const cleaned = cleanWikiText(artistRaw);
  const split = cleaned.split(/\s+(?:featuring|feat\.?|with|&|,)\s+/i);
  return split[0].trim();
}

function parseTracklist(wt, year) {
  // Extract every `| titleN = ...` / `| extraN = ...` pair from the first
  // `{{Track listing}}` block. Ignores disc-2 deluxe tracks since those are
  // reissues from older volumes and already covered by those volumes.
  // Some volumes use `{{Track listing}}`, others `{{tracklist}}`. Match
  // either (case-insensitive, optional space between "Track" and "listing").
  const tlMatch = wt.match(/\{\{\s*(?:track\s*listing|tracklist)/i);
  if (!tlMatch) return [];
  const tlStart = tlMatch.index;
  let depth = 0;
  let end = tlStart;
  for (let i = tlStart; i < wt.length - 1; i++) {
    if (wt[i] === "{" && wt[i + 1] === "{") {
      depth++;
      i++;
    } else if (wt[i] === "}" && wt[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const block = wt.substring(tlStart, end);
  const tracks = [];
  const titleRe = /\|\s*title(\d+)\s*=\s*([^\n]+)/g;
  const extraRe = /\|\s*extra(\d+)\s*=\s*([^\n]+)/g;
  const titles = new Map();
  const extras = new Map();
  for (const m of block.matchAll(titleRe)) titles.set(m[1], m[2].trim());
  for (const m of block.matchAll(extraRe)) extras.set(m[1], m[2].trim());
  for (const [n, title] of titles) {
    const cleanedTitle = cleanWikiText(title);
    const artistRaw = extras.get(n) ?? "";
    const artist = primaryArtist(artistRaw);
    if (!cleanedTitle || !artist) continue;
    tracks.push({ title: cleanedTitle, artist, year });
  }
  return tracks;
}

function parseYear(wt) {
  // {{start date|2014|05|06}} or `| released = May 6, 2014`
  const sd = wt.match(/\{\{start date\|(\d{4})/);
  if (sd) return Number(sd[1]);
  const rel = wt.match(/\|\s*released\s*=\s*([^\n]+)/);
  if (rel) {
    const y = rel[1].match(/(19|20)\d{2}/);
    if (y) return Number(y[0]);
  }
  return NaN;
}

let iTunesCache = {};
try {
  iTunesCache = JSON.parse(await readFile(CACHE, "utf8"));
} catch {}
async function persistCache() {
  await writeFile(CACHE, JSON.stringify(iTunesCache));
}

async function itunesFetchJson(url, attempt = 0) {
  // iTunes rate-limits aggressively (roughly 20 req/min). We pace the
  // caller to ~1.2s/req and back off exponentially on non-200 responses.
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 200) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  if (attempt >= 4) return null;
  const wait = 30000 * Math.pow(2, attempt);
  process.stdout.write(
    `  [rate-limited ${res.status}, sleeping ${wait / 1000}s]\n`,
  );
  await new Promise((r) => setTimeout(r, wait));
  return itunesFetchJson(url, attempt + 1);
}

async function itunesFind(title, artist) {
  const key = `${title}::${artist}`.toLowerCase();
  if (key in iTunesCache) return iTunesCache[key];
  const u = new URL("https://itunes.apple.com/search");
  u.searchParams.set("term", `${title} ${artist}`);
  u.searchParams.set("media", "music");
  u.searchParams.set("entity", "song");
  u.searchParams.set("limit", "10");
  u.searchParams.set("country", "US");
  const json = await itunesFetchJson(u.toString());
  if (!json) return null;
  const lc = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const lowerTitle = lc(title);
  const lowerArtist = lc(artist);
  for (const r of json.results ?? []) {
    if (!r.previewUrl || !r.trackId) continue;
    const rt = lc(r.trackName ?? "");
    const ra = lc(r.artistName ?? "");
    if (rt.includes(lowerTitle) || lowerTitle.includes(rt)) {
      if (ra.includes(lowerArtist) || lowerArtist.includes(ra.split(" ")[0])) {
        const hit = {
          id: `itunes-${r.trackId}`,
          title: r.trackName,
          artist: r.artistName,
          album: r.collectionName ?? "",
          albumArtUrl: (r.artworkUrl100 ?? "").replace("100x100", "512x512"),
          previewUrl: r.previewUrl,
          durationMs: r.trackTimeMillis ?? 0,
          releaseYear: r.releaseDate
            ? new Date(r.releaseDate).getUTCFullYear()
            : null,
        };
        iTunesCache[key] = hit;
        return hit;
      }
    }
  }
  return null;
}

async function main() {
  const pool = new Map();
  const volumeStats = [];
  for (let v = VOL_MIN; v <= VOL_MAX; v++) {
    const title = `Now That's What I Call Music! ${v} (American series)`;
    const wt = await wikitext(title);
    if (!wt) {
      process.stdout.write(`vol ${v}: (no page)\n`);
      continue;
    }
    const year = parseYear(wt);
    if (!Number.isFinite(year)) {
      process.stdout.write(`vol ${v}: (no year)\n`);
      continue;
    }
    if (year < YEAR_MIN || year > YEAR_MAX) {
      process.stdout.write(`vol ${v}: skip (year ${year})\n`);
      continue;
    }
    const tracks = parseTracklist(wt, year);
    let matched = 0;
    for (const t of tracks) {
      const key = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
      if (pool.has(key)) continue;
      const hit = await itunesFind(t.title, t.artist);
      if (!hit) continue;
      pool.set(key, hit);
      matched++;
      await new Promise((r) => setTimeout(r, 1300));
    }
    await persistCache();
    volumeStats.push({ vol: v, year, parsed: tracks.length, matched });
    process.stdout.write(
      `vol ${v} (${year}): parsed ${tracks.length}, matched ${matched} (pool=${pool.size})\n`,
    );
    await new Promise((r) => setTimeout(r, 120));
  }

  const list = [...pool.values()].sort((a, b) =>
    a.artist.localeCompare(b.artist),
  );
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        yearMin: YEAR_MIN,
        yearMax: YEAR_MAX,
        volumeCount: volumeStats.length,
        trackCount: list.length,
        volumes: volumeStats,
        tracks: list,
      },
      null,
      2,
    ),
  );
  console.log(
    `\nWrote ${list.length} tracks from ${volumeStats.length} volumes to ${OUT}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
