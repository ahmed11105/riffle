// Fetch tracklists for all NOW That's What I Call Music! volumes from
// Wikipedia and save as a static JSON file. This provides the admin album
// browser with complete song lists for every volume, even ones that have
// been delisted from iTunes/Spotify.
//
// Output: src/lib/daily/now-tracklists.json
//
// Run: node scripts/fetch-now-tracklists.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/lib/daily/now-tracklists.json");
const UA = "RiffRace/1.0 (https://github.com/uzair/riffrace) node-fetch";

const YEAR_MIN = 2000;
const YEAR_MAX = 2026;

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
  const wt = String(json.parse.wikitext);
  if (wt.startsWith("#REDIRECT")) return null;
  return wt;
}

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

function primaryArtist(raw) {
  const cleaned = cleanWikiText(raw);
  return cleaned.split(/\s+(?:featuring|feat\.?|with|&|,)\s+/i)[0].trim();
}

function parseTracklist(wt) {
  const tlMatch = wt.match(/\{\{\s*(?:track\s*listing|tracklist)/i);
  if (!tlMatch) return [];
  const tlStart = tlMatch.index;
  let depth = 0;
  let end = tlStart;
  for (let i = tlStart; i < wt.length - 1; i++) {
    if (wt[i] === "{" && wt[i + 1] === "{") { depth++; i++; }
    else if (wt[i] === "}" && wt[i + 1] === "}") { depth--; i++; if (depth === 0) { end = i + 1; break; } }
  }
  const block = wt.substring(tlStart, end);
  const titles = new Map();
  const extras = new Map();
  for (const m of block.matchAll(/\|\s*title(\d+)\s*=\s*([^\n]+)/g)) titles.set(m[1], m[2].trim());
  for (const m of block.matchAll(/\|\s*extra(\d+)\s*=\s*([^\n]+)/g)) extras.set(m[1], m[2].trim());
  const tracks = [];
  for (const [n, title] of titles) {
    const cleanedTitle = cleanWikiText(title);
    const artistRaw = extras.get(n) ?? "";
    const artist = primaryArtist(artistRaw);
    const fullArtist = cleanWikiText(artistRaw);
    if (!cleanedTitle || !artist) continue;
    tracks.push({ title: cleanedTitle, artist, fullArtist });
  }
  return tracks;
}

function parseYear(wt) {
  const sd = wt.match(/\{\{start date\|(\d{4})/);
  if (sd) return Number(sd[1]);
  const rel = wt.match(/\|\s*released\s*=\s*([^\n]+)/);
  if (rel) { const y = rel[1].match(/(19|20)\d{2}/); if (y) return Number(y[0]); }
  return NaN;
}

// Also try the UK series page format (no "(American series)" suffix)
const PAGE_FORMATS = [
  (v) => `Now That's What I Call Music! ${v} (American series)`,
  (v) => `Now That's What I Call Music! ${v}`,
];

async function main() {
  const volumes = [];
  for (let v = 1; v <= 122; v++) {
    let wt = null;
    for (const fmt of PAGE_FORMATS) {
      wt = await wikitext(fmt(v));
      if (wt) break;
      await new Promise(r => setTimeout(r, 100));
    }
    if (!wt) {
      process.stdout.write(`vol ${v}: no page\n`);
      continue;
    }
    const year = parseYear(wt);
    if (!Number.isFinite(year)) {
      process.stdout.write(`vol ${v}: no year\n`);
      continue;
    }
    const tracks = parseTracklist(wt);
    if (tracks.length === 0) {
      process.stdout.write(`vol ${v} (${year}): no tracks parsed\n`);
      continue;
    }
    volumes.push({ vol: v, year, tracks });
    process.stdout.write(`vol ${v} (${year}): ${tracks.length} tracks\n`);
    await new Promise(r => setTimeout(r, 150));
  }

  const totalTracks = volumes.reduce((s, v) => s + v.tracks.length, 0);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    volumeCount: volumes.length,
    totalTracks,
    volumes,
  }, null, 2));
  console.log(`\nWrote ${volumes.length} volumes (${totalTracks} tracks) to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
