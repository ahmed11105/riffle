// Schedule 365 days of well-known daily songs, pushing overrides to
// the production Supabase API. Songs are ranked by cultural recognition
// and shuffled within tiers so the schedule feels varied.
//
// Run: node scripts/schedule-year.mjs

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POOL_PATH = resolve(__dirname, "../src/lib/daily/now-pool.json");
const API = "https://riffle.cc/api/daily/overrides";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// ── Tier 1: Everyone knows these (most recognizable first) ──────────
const TIER1 = [
  "Crazy in Love", "Bye Bye Bye", "I Gotta Feeling", "Someone Like You",
  "All the Small Things", "Irreplaceable", "Wake Me Up", "Where Is The Love?",
  "Happy", "Dark Horse", "Counting Stars", "Wrecking Ball", "All of Me",
  "Royals", "Kryptonite", "Say Something", "Here Without You", "Try Again",
  "Pompeii", "No One", "Incomplete", "Larger Than Life", "Burn",
  "Story Of My Life", "It's Gonna Be Me", "It's My Life", "Hey Brother",
  "All the Small Things", "This Love", "She Will Be Loved",
  "Yellow", "The Scientist", "In Da Club", "Hot In Herre", "Dilemma",
  "Beautiful", "Since U Been Gone", "Because Of You", "Breakaway",
  "Umbrella", "Disturbia", "SOS", "Hips Don't Lie",
  "Get the Party Started", "Family Affair", "I Knew I Loved You",
  "I Want It That Way", "Lucky", "Stronger", "Oops!...I Did It Again",
];

// ── Tier 2: Very well known ──────────────────────────────────────────
const TIER2 = [
  "I'm a Slave 4 U", "Bootylicious", "Say My Name",
  "Rock The Boat", "More Than A Woman", "Shape of My Heart",
  "The Call", "Show Me the Meaning of Being Lonely", "Pop",
  "This I Promise You", "Ride Wit Me", "Country Grammar",
  "Blue (Da Ba Dee)", "It Wasn't Me", "Who Let the Dogs Out",
  "Jumpin' Jumpin'", "No Scrubs", "Aaron's Party (Come Get It)",
  "A Thousand Miles", "My First Kiss", "Gotta Tell You",
  "Case of the Ex", "I Wanna Know", "Candy", "I Try",
  "Shake It Fast", "Absolutely (Story of a Girl)", "Steal My Kisses",
  "Gone", "Drowning", "More Than That", "The Rock Show", "First Date",
  "Flavor of the Weak", "1 Thing", "Goodies", "Lose My Breath",
  "Breathe", "Just Like A Pill", "Nothin' On You",
  "Lighters", "My First Kiss", "Sail", "Hey There Delilah",
  "Honey Bee", "Need You Now", "Love Story", "You Belong With Me",
  "Tik Tok", "Dynamite", "Just the Way You Are",
  "Grenade", "Just A Dream", "Whatcha Say", "Replay",
  "Poker Face", "Bad Romance", "Just Dance", "Paparazzi",
  "Baby", "Somebody That I Used To Know", "Moves Like Jagger",
  "Payphone", "Sugar", "Maps", "Locked Out Of Heaven",
  "When I Was Your Man", "Treasure", "Stereo Hearts",
  "We Found Love", "What Makes You Beautiful", "Best Song Ever",
  "Roar", "Firework", "Teenage Dream", "California Gurls",
  "E.T.", "Wide Awake", "Part of Me",
  "Love Me Harder", "Problem", "Break Free",
  "Bang Bang", "Anaconda", "Super Bass",
  "Starboy", "Can't Feel My Face", "Earned It",
  "Attention", "We Don't Talk Anymore", "How Long",
  "Shape of You", "Thinking Out Loud", "Photograph",
  "Hello", "Rolling in the Deep", "Set Fire to the Rain",
  "Uptown Funk", "24K Magic", "That's What I Like",
  "Chandelier", "Cheap Thrills", "Titanium",
  "Closer", "Don't Let Me Down",
  "Unconditionally", "Let Her Go", "Radioactive", "Demons",
  "Talk Dirty", "Trumpets", "Selfie", "Turn Down for What",
  "Show Me", "Stay the Night", "Last Love Song",
  "Do What U Want", "Drink a Beer", "TKO",
  "Team", "Adore You", "Young Girls", "Gorilla",
  "La La La", "Big Talk", "On My Mind",
  "She Keeps Me Warm", "Ten Feet Tall", "Best Day of My Life",
  "The Man", "Alienation", "G.R.L.", "Natalia Kills",
];

// ── Tier 3: Recognizable deep cuts ──────────────────────────────────
const TIER3 = [
  "Caramel", "Faded", "Crazy for This Girl", "Then the Morning Comes",
  "It Feels so Good", "Meet Virginia", "Walk On", "Wonderful",
  "This Time Around", "Be Like That", "When I'm Gone",
  "The Road I'm On", "Let Me Go", "No More (Baby I'ma Do Right)",
  "Playas Gon' Play", "Jennifer Lopez", "Waiting for Tonight",
  "Give Me Just One Night", "Janet Jackson", "Doesn't Really Matter",
  "I Wanna Be With You", "I Need to Know", "Get It On Tonite",
  "Everyday", "Girl All the Bad Guys Want", "My First Kiss",
  "If I Had You", "Back Here", "Angel",
  "Breathe (2 AM)", "Loving You Tonight", "Blackout",
  "Jaded", "Move It Like This", "Suga Suga",
  "Feel It Boy", "Bump, Bump, Bump", "Girlfriend",
  "Shortie Like Mine", "Let U Go", "Baby, I'm Back",
  "Doesn't Get Better", "Worry About You", "Rock That Body",
  "Just Can't Get Enough", "Imma Be", "Check On It",
  "Déjà-vu", "Giving In",
];

function lower(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

async function main() {
  const pool = JSON.parse(await readFile(POOL_PATH, "utf8")).tracks;

  // Match titles to pool tracks
  const used = new Set();
  function findInPool(title) {
    const lt = lower(title);
    const match = pool.find(t => {
      if (used.has(t.id)) return false;
      const rt = lower(t.title);
      return rt.includes(lt) || lt.includes(rt);
    });
    if (match) used.add(match.id);
    return match;
  }

  // Build ordered list: tier1 shuffled, then tier2 shuffled, then tier3 shuffled
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const ordered = [];
  for (const title of shuffle(TIER1)) {
    const t = findInPool(title);
    if (t) ordered.push(t);
  }
  for (const title of shuffle(TIER2)) {
    const t = findInPool(title);
    if (t) ordered.push(t);
  }
  for (const title of shuffle(TIER3)) {
    const t = findInPool(title);
    if (t) ordered.push(t);
  }
  // Fill remaining days with random unused pool tracks
  const remaining = pool.filter(t => !used.has(t.id));
  for (const t of shuffle(remaining)) {
    ordered.push(t);
    if (ordered.length >= 365) break;
  }

  console.log(`Scheduled ${Math.min(ordered.length, 365)} days (${ordered.length} tracks available)`);
  console.log(`  Tier 1: first ~${TIER1.length} days (mega-hits)`);
  console.log(`  Tier 2: next ~${TIER2.length} days (very well known)`);
  console.log(`  Tier 3+: remainder (deep cuts + pool fill)\n`);

  // Build overrides for 365 days starting today
  const now = new Date();
  const BATCH = 50; // API can handle bulk, but let's be safe
  for (let start = 0; start < 365; start += BATCH) {
    const overrides = {};
    for (let i = start; i < Math.min(start + BATCH, 365); i++) {
      if (i >= ordered.length) break;
      const d = new Date(now.getTime() + i * 86400000);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      const t = ordered[i];
      overrides[key] = {
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album || "",
        albumArtUrl: t.albumArtUrl || "",
        previewUrl: t.previewUrl,
        durationMs: t.durationMs || 0,
        releaseYear: t.releaseYear || null,
      };
    }
    const count = Object.keys(overrides).length;
    if (count === 0) break;
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ADMIN_SECRET}`,
      },
      body: JSON.stringify({ overrides }),
    });
    const json = await res.json();
    console.log(`  Batch ${Math.floor(start/BATCH)+1}: days ${start+1}-${start+count} → ${json.upserted ?? 0} upserted`);
    await new Promise(r => setTimeout(r, 500));
  }

  // Show first 14 days
  console.log("\nFirst 14 days:");
  for (let i = 0; i < 14 && i < ordered.length; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    console.log(`  ${d.toDateString()} → ${ordered[i].title} - ${ordered[i].artist}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
