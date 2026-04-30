// Fetch tracklists for ALL NOW volumes from the NOW Music Fandom Wiki.
// This gives us complete song lists for every volume including ones
// delisted from iTunes/Spotify, solving the "unavailable" problem.
//
// Output: src/lib/daily/now-tracklists.json (replaces the Wikipedia-only version)
//
// Run: node scripts/fetch-fandom-tracklists.mjs

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/lib/daily/now-tracklists.json");
const UA = "RiffRace/1.0 (https://riffle.cc) node-fetch";
const BASE = "https://nowmusic.fandom.com/api.php";

async function wikitext(title) {
  const u = new URL(BASE);
  u.searchParams.set("action", "parse");
  u.searchParams.set("page", title);
  u.searchParams.set("prop", "wikitext");
  u.searchParams.set("format", "json");
  u.searchParams.set("formatversion", "2");
  const res = await fetch(u.toString(), { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.error) return null;
  return json.parse?.wikitext ?? null;
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
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryArtist(raw) {
  const cleaned = cleanWikiText(raw);
  return cleaned.split(/\s+(?:featuring|feat\.?|ft\.?|with|&|,)\s+/i)[0].trim();
}

function parseYear(wt) {
  // Try infobox Released field
  const rel = wt.match(/\|\s*Released\s*=\s*([^\n|]+)/i);
  if (rel) {
    const y = rel[1].match(/(19|20)\d{2}/);
    if (y) return Number(y[0]);
  }
  return NaN;
}

function parseTracklist(wt) {
  // Fandom wiki uses numbered lines like:
  //   # Artist - "Title"
  //   # Artist feat. Other - "Title"
  // or sometimes {{Track listing}} templates. Handle both.
  const tracks = [];

  // Pattern 1: numbered lines. Fandom uses several formats:
  //   # Artist : "Title"        (colon separator — most common)
  //   # Artist - "Title"        (dash separator)
  //   # Artist — "Title"        (em-dash)
  // Titles may be in "quotes", ''wiki-italic'', or "smart quotes".
  const linePattern = /^#\s*(.+?)\s*[:\-–—]\s*["''""]+(.+?)["''""]+/gm;
  for (const m of wt.matchAll(linePattern)) {
    const artistRaw = m[1].trim();
    const title = cleanWikiText(m[2].trim());
    const artist = primaryArtist(artistRaw);
    const fullArtist = cleanWikiText(artistRaw);
    if (title && artist) {
      tracks.push({ title, artist, fullArtist });
    }
  }

  // Pattern 2: {{Track listing}} template (same as Wikipedia)
  if (tracks.length === 0) {
    const allBlocks = [...wt.matchAll(/\{\{\s*(?:track\s*listing|tracklist)/gi)];
    for (const blockMatch of allBlocks) {
      const start = blockMatch.index;
      let depth = 0;
      let end = start;
      for (let i = start; i < wt.length - 1; i++) {
        if (wt[i] === "{" && wt[i + 1] === "{") { depth++; i++; }
        else if (wt[i] === "}" && wt[i + 1] === "}") { depth--; i++; if (depth === 0) { end = i + 1; break; } }
      }
      const block = wt.substring(start, end);
      const titles = new Map();
      const extras = new Map();
      for (const m of block.matchAll(/\|\s*title(\d+)\s*=\s*([^\n]+)/g)) titles.set(m[1], m[2].trim());
      for (const m of block.matchAll(/\|\s*extra(\d+)\s*=\s*([^\n]+)/g)) extras.set(m[1], m[2].trim());
      for (const [n, title] of titles) {
        const cleanedTitle = cleanWikiText(title);
        const artistRaw = extras.get(n) ?? "";
        const artist = primaryArtist(artistRaw);
        const fullArtist = cleanWikiText(artistRaw);
        if (cleanedTitle && artist) {
          tracks.push({ title: cleanedTitle, artist, fullArtist });
        }
      }
    }
  }

  return tracks;
}

// Try multiple page title formats that the Fandom wiki uses.
const PAGE_FORMATS = [
  (v) => `Now That's What I Call Music! ${v} (UK Series)`,
  (v) => `Now That's What I Call Music! ${v} (US Series)`,
  (v) => `Now That's What I Call Music! ${v}`,
  (v) => `Now That's What I Call Music ${v}`,
];

async function main() {
  const volumes = [];

  for (let v = 1; v <= 122; v++) {
    let wt = null;
    let pageTitle = "";
    for (const fmt of PAGE_FORMATS) {
      pageTitle = fmt(v);
      wt = await wikitext(pageTitle);
      if (wt) break;
      await new Promise(r => setTimeout(r, 80));
    }
    if (!wt) {
      process.stdout.write(`vol ${v}: no page\n`);
      continue;
    }
    const year = parseYear(wt);
    const tracks = parseTracklist(wt);
    if (tracks.length === 0) {
      process.stdout.write(`vol ${v} (${year || "?"}): 0 tracks parsed\n`);
      continue;
    }
    volumes.push({ vol: v, year: Number.isFinite(year) ? year : null, tracks });
    process.stdout.write(`vol ${v} (${year || "?"}): ${tracks.length} tracks\n`);
    await new Promise(r => setTimeout(r, 150));
  }

  const totalTracks = volumes.reduce((s, v) => s + v.tracks.length, 0);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "nowmusic.fandom.com",
    volumeCount: volumes.length,
    totalTracks,
    volumes,
  }, null, 2));
  console.log(`\nWrote ${volumes.length} volumes (${totalTracks} tracks) to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
