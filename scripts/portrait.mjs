// Turns scripts/source-photo.jpg into an animated ASCII-art SVG (assets/portrait.svg).
// Run once locally (needs `npm install`): node scripts/portrait.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const COLS = 72;
const ROWS = 40;
const CHAR_W = 6; // px per character at font-size 10
const LINE_H = 10.5;
const PAD = 14;
const RAMP = " .'`,:;-~=+*ox%#@"; // dark -> bright (the photo is dark, so bright = dense)

const { data } = await sharp("scripts/source-photo.jpg")
  .extract({ left: 40, top: 0, width: 340, height: 330 }) // face + skull, drop the dark coat
  .resize(COLS, ROWS, { fit: "fill" })
  .greyscale()
  .normalise()
  .linear(1.25, -18) // extra contrast
  .raw()
  .toBuffer({ resolveWithObject: true });

const rows = [];
for (let y = 0; y < ROWS; y++) {
  let line = "";
  for (let x = 0; x < COLS; x++) {
    const v = data[y * COLS + x] / 255;
    line += RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
  }
  rows.push(line);
}

// Spaces become non-breaking so browsers never collapse them.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&#160;");
const width = COLS * CHAR_W + PAD * 2;
const height = ROWS * LINE_H + PAD * 2 + 4;

const clips = [];
const texts = [];
rows.forEach((line, i) => {
  const y = PAD + (i + 1) * LINE_H;
  const begin = (0.25 + i * 0.045).toFixed(3);
  clips.push(
    `<clipPath id="r${i}"><rect x="${PAD}" y="${(y - LINE_H).toFixed(1)}" height="${LINE_H + 2}" width="0">` +
      `<animate attributeName="width" from="0" to="${COLS * CHAR_W}" begin="${begin}s" dur="0.55s" fill="freeze"/></rect></clipPath>`,
  );
  texts.push(`<text x="${PAD}" y="${y.toFixed(1)}" clip-path="url(#r${i})">${esc(line)}</text>`);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="ASCII art portrait">
<defs>${clips.join("")}</defs>
<rect width="100%" height="100%" rx="10" fill="#0d1117" stroke="#30363d"/>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="10" fill="#c9d1d9" xml:space="preserve">
${texts.join("\n")}
</g>
</svg>
`;
writeFileSync("assets/portrait.svg", svg);
console.log(`assets/portrait.svg written (${width}x${height})`);
