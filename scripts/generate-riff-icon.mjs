// Regenerates public/riff-icon.png from a thicker SVG so the small
// renders (the 18px chip on the top-right balance pill, the 10px
// inline icon on reward chips) don't go skinny.
//
// Layout:
//   - Drop shadow: silhouette offset (28, 28) px in pure black.
//   - Outline: silhouette in stone-900 black, sized as silhouette
//     dilated by the chosen outline radius (~38 px).
//   - Fill: silhouette in amber-400 #fbbf24.
//
// We compose the silhouette from two overlapping shapes (an ellipse
// for the note head + a single path for the thick stem and flag) and
// rely on `feMorphology dilate` to produce a unified outline around
// the union — no internal seam where the stem meets the head, which
// is what the previous hand-drawn version had to live with.

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIZE = 1024;
const AMBER = "#fbbf24";
const INK = "#1c1917";
const OUTLINE_RADIUS = 38;
const SHADOW_OFFSET = 28;

// Stem is the part the user reported looks thin at small sizes.
// The old icon used roughly 80 px on a 950 canvas; this rebuild
// goes to a 170 px wide stem on a 1024 canvas (~17% of width vs
// the previous ~8%).
const STEM_LEFT = 480;
const STEM_RIGHT = 650;
const STEM_TOP = 100;
const STEM_BOTTOM = 850;

// Head is rotated for the classic music-note tilt. Sized so the
// stem visually rises out of the head's right shoulder.
const HEAD_CX = 320;
const HEAD_CY = 780;
const HEAD_RX = 235;
const HEAD_RY = 165;
const HEAD_ROT = -22;

// Three discrete shapes (head, stem, flag). The dilate-based
// outline filter unions their alphas before producing the black
// edge, so internal seams (stem ↔ head, flag ↔ stem) don't get
// drawn — only the outer silhouette does.
const SHAPES = `
  <!-- Head: tilted oval. -->
  <ellipse cx="${HEAD_CX}" cy="${HEAD_CY}" rx="${HEAD_RX}" ry="${HEAD_RY}"
           transform="rotate(${HEAD_ROT} ${HEAD_CX} ${HEAD_CY})"/>
  <!-- Thick straight stem with rounded top corners. -->
  <rect x="${STEM_LEFT}" y="${STEM_TOP}" width="${STEM_RIGHT - STEM_LEFT}"
        height="${STEM_BOTTOM - STEM_TOP}" rx="6"/>
  <!-- Flag: a tapered leaf that attaches near the very top of the
       stem, sweeps up-and-out, then curls back down — narrower at
       both attachment and tail so it reads as a distinct shape on
       top of the stem rather than just widening the stem itself. -->
  <path d="
    M ${STEM_RIGHT - 8} ${STEM_TOP + 8}
    C ${STEM_RIGHT + 80}  ${STEM_TOP - 30}
      ${STEM_RIGHT + 220} ${STEM_TOP + 40}
      ${STEM_RIGHT + 280} ${STEM_TOP + 200}
    C ${STEM_RIGHT + 320} ${STEM_TOP + 350}
      ${STEM_RIGHT + 260} ${STEM_TOP + 470}
      ${STEM_RIGHT + 130} ${STEM_TOP + 540}
    C ${STEM_RIGHT + 70}  ${STEM_TOP + 570}
      ${STEM_RIGHT + 20}  ${STEM_TOP + 560}
      ${STEM_RIGHT - 8}   ${STEM_TOP + 540}
    C ${STEM_RIGHT + 60}  ${STEM_TOP + 470}
      ${STEM_RIGHT + 130} ${STEM_TOP + 380}
      ${STEM_RIGHT + 140} ${STEM_TOP + 270}
    C ${STEM_RIGHT + 140} ${STEM_TOP + 180}
      ${STEM_RIGHT + 80}  ${STEM_TOP + 90}
      ${STEM_RIGHT - 8}   ${STEM_TOP + 70}
    Z
  "/>
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <!-- Outline filter: dilates the alpha of whatever it's applied
         to, fills with INK, then merges the source on top — yielding
         a single unified outline around the union of shapes. -->
    <filter id="outline" x="-25%" y="-25%" width="150%" height="150%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${OUTLINE_RADIUS}" result="ring"/>
      <feFlood flood-color="${INK}" result="black"/>
      <feComposite in="black" in2="ring" operator="in" result="ringFill"/>
      <feMerge>
        <feMergeNode in="ringFill"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <!-- Drop shadow filter: same dilate trick offset by (28, 28) px,
         filled with INK, no source merged. We render this layer
         FIRST so it sits behind the icon body. -->
    <filter id="drop" x="-25%" y="-25%" width="160%" height="160%">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${OUTLINE_RADIUS}" result="ring"/>
      <feOffset in="ring" dx="${SHADOW_OFFSET}" dy="${SHADOW_OFFSET}" result="offset"/>
      <feFlood flood-color="${INK}" result="black"/>
      <feComposite in="black" in2="offset" operator="in"/>
    </filter>
  </defs>
  <!-- Drop shadow layer. -->
  <g fill="${INK}" filter="url(#drop)">${SHAPES}</g>
  <!-- Body + outline. -->
  <g fill="${AMBER}" filter="url(#outline)">${SHAPES}</g>
</svg>`;

const out = path.resolve(__dirname, "..", "public", "riff-icon.png");

await sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log("Wrote", out);
