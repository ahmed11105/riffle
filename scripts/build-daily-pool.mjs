// Build a curated daily pool from:
// 1. NOW Wikipedia tracklists (already parsed) — well-known pop songs 2000-2015
// 2. A hand-picked list of pre-2000 and post-2015 iconic songs
// 3. Resolve each to an iTunes preview URL
//
// Output: src/lib/daily/now-pool.json (replaces the old one)
//
// Run: node scripts/build-daily-pool.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRACKLISTS = resolve(__dirname, "../src/lib/daily/now-tracklists.json");
const OUT = resolve(__dirname, "../src/lib/daily/now-pool.json");

// Pre-2000 classics and post-2015 iconic songs that everyone knows.
// These supplement the NOW tracklists to give good coverage for the
// "songs people actually know in pop culture" requirement.
const EXTRA_SONGS = [
  // Pre-2000 classics
  { title: "Billie Jean", artist: "Michael Jackson" },
  { title: "Thriller", artist: "Michael Jackson" },
  { title: "Beat It", artist: "Michael Jackson" },
  { title: "Smooth Criminal", artist: "Michael Jackson" },
  { title: "Black or White", artist: "Michael Jackson" },
  { title: "Bohemian Rhapsody", artist: "Queen" },
  { title: "Don't Stop Me Now", artist: "Queen" },
  { title: "We Will Rock You", artist: "Queen" },
  { title: "Crazy Train", artist: "Ozzy Osbourne" },
  { title: "Mr. Brightside", artist: "The Killers" },
  { title: "Hey Jude", artist: "The Beatles" },
  { title: "Let It Be", artist: "The Beatles" },
  { title: "Come Together", artist: "The Beatles" },
  { title: "Yesterday", artist: "The Beatles" },
  { title: "Livin' on a Prayer", artist: "Bon Jovi" },
  { title: "Sweet Child O' Mine", artist: "Guns N' Roses" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana" },
  { title: "Wonderwall", artist: "Oasis" },
  { title: "No Diggity", artist: "Blackstreet" },
  { title: "Wannabe", artist: "Spice Girls" },
  { title: "...Baby One More Time", artist: "Britney Spears" },
  { title: "I Want It That Way", artist: "Backstreet Boys" },
  { title: "Everybody (Backstreet's Back)", artist: "Backstreet Boys" },
  { title: "Waterfalls", artist: "TLC" },
  { title: "No Scrubs", artist: "TLC" },
  { title: "Killing Me Softly", artist: "Fugees" },
  { title: "Gangsta's Paradise", artist: "Coolio" },
  { title: "Kiss from a Rose", artist: "Seal" },
  { title: "I Will Always Love You", artist: "Whitney Houston" },
  { title: "Un-Break My Heart", artist: "Toni Braxton" },
  { title: "MMMBop", artist: "Hanson" },
  { title: "Blue (Da Ba Dee)", artist: "Eiffel 65" },
  // Post-2015 iconic songs
  { title: "Blinding Lights", artist: "The Weeknd" },
  { title: "Shape of You", artist: "Ed Sheeran" },
  { title: "Thinking Out Loud", artist: "Ed Sheeran" },
  { title: "Uptown Funk", artist: "Bruno Mars" },
  { title: "That's What I Like", artist: "Bruno Mars" },
  { title: "Old Town Road", artist: "Lil Nas X" },
  { title: "Bad Guy", artist: "Billie Eilish" },
  { title: "Happier Than Ever", artist: "Billie Eilish" },
  { title: "Levitating", artist: "Dua Lipa" },
  { title: "Don't Start Now", artist: "Dua Lipa" },
  { title: "drivers license", artist: "Olivia Rodrigo" },
  { title: "good 4 u", artist: "Olivia Rodrigo" },
  { title: "Flowers", artist: "Miley Cyrus" },
  { title: "As It Was", artist: "Harry Styles" },
  { title: "Watermelon Sugar", artist: "Harry Styles" },
  { title: "Sunflower", artist: "Post Malone" },
  { title: "Circles", artist: "Post Malone" },
  { title: "Stay", artist: "The Kid LAROI" },
  { title: "Peaches", artist: "Justin Bieber" },
  { title: "Love Yourself", artist: "Justin Bieber" },
  { title: "Sorry", artist: "Justin Bieber" },
  { title: "God's Plan", artist: "Drake" },
  { title: "Hotline Bling", artist: "Drake" },
  { title: "HUMBLE.", artist: "Kendrick Lamar" },
  { title: "Starboy", artist: "The Weeknd" },
  { title: "Save Your Tears", artist: "The Weeknd" },
  { title: "Someone You Loved", artist: "Lewis Capaldi" },
  { title: "Dance Monkey", artist: "Tones and I" },
  { title: "Señorita", artist: "Shawn Mendes" },
  { title: "Havana", artist: "Camila Cabello" },
  { title: "Closer", artist: "The Chainsmokers" },
  { title: "Despacito", artist: "Luis Fonsi" },
  { title: "Perfect", artist: "Ed Sheeran" },
  { title: "Shallow", artist: "Lady Gaga" },
  { title: "Thank U, Next", artist: "Ariana Grande" },
  { title: "7 Rings", artist: "Ariana Grande" },
  { title: "Anti-Hero", artist: "Taylor Swift" },
  { title: "Shake It Off", artist: "Taylor Swift" },
  { title: "Blank Space", artist: "Taylor Swift" },
  { title: "Cruel Summer", artist: "Taylor Swift" },
  { title: "Espresso", artist: "Sabrina Carpenter" },
  { title: "Vampire", artist: "Olivia Rodrigo" },
  { title: "Paint The Town Red", artist: "Doja Cat" },
  { title: "Unholy", artist: "Sam Smith" },
  { title: "Heat Waves", artist: "Glass Animals" },
  { title: "About Damn Time", artist: "Lizzo" },
  { title: "Running Up That Hill", artist: "Kate Bush" },
  { title: "Easy On Me", artist: "Adele" },
  { title: "Rolling in the Deep", artist: "Adele" },
  { title: "Someone Like You", artist: "Adele" },
  { title: "Hello", artist: "Adele" },
];

async function itunesFind(title, artist) {
  const u = new URL("https://itunes.apple.com/search");
  u.searchParams.set("term", `${title} ${artist}`);
  u.searchParams.set("media", "music");
  u.searchParams.set("entity", "song");
  u.searchParams.set("limit", "5");
  u.searchParams.set("country", "US");
  const res = await fetch(u.toString());
  if (!res.ok) return null;
  let json;
  try { json = await res.json(); } catch { return null; }
  const lc = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const lt = lc(title);
  const la = lc(artist).split(" ")[0];
  for (const r of json.results ?? []) {
    if (!r.previewUrl || !r.trackId) continue;
    const rt = lc(r.trackName ?? "");
    const ra = lc(r.artistName ?? "");
    if ((rt.includes(lt) || lt.includes(rt)) && ra.includes(la)) {
      return {
        id: `itunes-${r.trackId}`,
        title: r.trackName,
        artist: r.artistName,
        album: r.collectionName ?? "",
        albumArtUrl: (r.artworkUrl100 ?? "").replace("100x100", "512x512"),
        previewUrl: r.previewUrl,
        durationMs: r.trackTimeMillis ?? 0,
        releaseYear: r.releaseDate ? new Date(r.releaseDate).getUTCFullYear() : null,
      };
    }
  }
  return null;
}

async function main() {
  // Load Wikipedia tracklists
  const wiki = JSON.parse(await readFile(TRACKLISTS, "utf8"));
  const allSongs = [];

  // Add NOW tracklist songs
  for (const vol of wiki.volumes) {
    for (const t of vol.tracks) {
      allSongs.push({ title: t.title, artist: t.artist, source: `NOW ${vol.vol}` });
    }
  }

  // Add extra curated songs
  for (const s of EXTRA_SONGS) {
    allSongs.push({ ...s, source: "curated" });
  }

  // Dedupe by title+artist
  const seen = new Set();
  const unique = allSongs.filter(s => {
    const key = `${s.title.toLowerCase()}::${s.artist.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Total unique songs to resolve: ${unique.length}`);

  // Resolve via iTunes with rate limiting
  const pool = [];
  let resolved = 0;
  let failed = 0;

  for (let i = 0; i < unique.length; i++) {
    const s = unique[i];
    const hit = await itunesFind(s.title, s.artist);
    if (hit) {
      const dedupeKey = `${hit.title.toLowerCase()}::${hit.artist.toLowerCase()}`;
      if (!seen.has(`resolved::${dedupeKey}`)) {
        seen.add(`resolved::${dedupeKey}`);
        pool.push(hit);
        resolved++;
      }
    } else {
      failed++;
    }
    if ((i + 1) % 20 === 0 || i === unique.length - 1) {
      process.stdout.write(`  progress: ${i + 1}/${unique.length} (${resolved} resolved, ${failed} failed)\n`);
    }
    // Rate limit: ~15 req/min to be safe
    await new Promise(r => setTimeout(r, 4200));
  }

  const sorted = pool.sort((a, b) => a.artist.localeCompare(b.artist));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    trackCount: sorted.length,
    tracks: sorted,
  }, null, 2));

  console.log(`\nWrote ${sorted.length} tracks to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
