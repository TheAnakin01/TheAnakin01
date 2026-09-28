// Scrapes the public contribution calendar and writes an animated heatmap (assets/heatmap.svg).
// No dependencies and no token needed. Run: node scripts/heatmap.mjs
import { readFileSync, writeFileSync } from "node:fs";

const USER = process.env.GH_USER || "TheAnakin01";
const res = await fetch(`https://github.com/users/${USER}/contributions`, {
  headers: { "User-Agent": `${USER}-profile-readme` },
});
if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
const html = await res.text();

// Tooltips hold the counts: <tool-tip for="contribution-day-component-0-0">3 contributions on ...</tool-tip>
const counts = new Map();
for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
  const n = m[2].match(/^(\d+)\s+contribution/);
  counts.set(m[1], n ? Number(n[1]) : 0);
}

const days = [];
for (const m of html.matchAll(/<td[^>]*class="ContributionCalendar-day"[^>]*>/g)) {
  const tag = m[0];
  const date = tag.match(/data-date="([^"]+)"/)?.[1];
  const level = Number(tag.match(/data-level="(\d)"/)?.[1] ?? 0);
  const id = tag.match(/id="([^"]+)"/)?.[1];
  if (date) days.push({ date, level, count: counts.get(id) ?? 0 });
}
if (days.length < 300) throw new Error(`Only found ${days.length} days — page format may have changed`);
days.sort((a, b) => a.date.localeCompare(b.date));

const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 36;
const TOP = 52;
const WIDTH = 860;
const COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const first = new Date(days[0].date + "T00:00:00Z");
const offset = first.getUTCDay(); // row of the first day (0 = Sunday)
let total = 0;
const cells = [];
const monthLabels = [];
let lastMonth = -1;
days.forEach((d, i) => {
  const col = Math.floor((i + offset) / 7);
  const row = (i + offset) % 7;
  total += d.count;
  const dt = new Date(d.date + "T00:00:00Z");
  if (row === 0 || i === 0) {
    const mo = dt.getUTCMonth();
    if (mo !== lastMonth && dt.getUTCDate() <= 7 && col < 52) {
      monthLabels.push(`<text x="${LEFT + col * STEP}" y="${TOP - 8}">${MONTHS[mo]}</text>`);
    }
    lastMonth = mo;
  }
  const delay = ((col + row) * 0.018).toFixed(3);
  cells.push(
    `<rect x="${LEFT + col * STEP}" y="${TOP + row * STEP}" width="${CELL}" height="${CELL}" rx="2.5" fill="${COLORS[d.level]}" style="animation-delay:${delay}s"><title>${d.count} on ${d.date}</title></rect>`,
  );
});
const cols = Math.ceil((days.length + offset) / 7);
const HEIGHT = TOP + 7 * STEP + 40;
const legendX = LEFT + cols * STEP - 5 * STEP - 70;
const legend = COLORS.map(
  (c, i) => `<rect x="${legendX + 34 + i * STEP}" y="${HEIGHT - 26}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`,
).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${total} contributions in the last year">
<style>
  .c rect { opacity: 0; transform-box: fill-box; transform-origin: center; animation: pop .45s ease-out forwards; }
  @keyframes pop { from { opacity: 0; transform: scale(.2); } to { opacity: 1; transform: scale(1); } }
  text { font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size: 10px; fill: #8b949e; }
  .h { font-size: 13px; fill: #c9d1d9; }
  .p { fill: #39d353; }
  @media (prefers-reduced-motion: reduce) { .c rect { animation: none; opacity: 1; } }
</style>
<rect width="100%" height="100%" rx="10" fill="#0d1117" stroke="#30363d"/>
<text class="h" x="${LEFT - 20}" y="24"><tspan class="p">$</tspan> git log --since="1 year ago" | wc -l   <tspan fill="#8b949e">→</tspan> ${total} contributions</text>
${monthLabels.join("")}
<text x="6" y="${TOP + 1 * STEP + 10}">Mon</text><text x="6" y="${TOP + 3 * STEP + 10}">Wed</text><text x="6" y="${TOP + 5 * STEP + 10}">Fri</text>
<g class="c">${cells.join("")}</g>
<text x="${legendX}" y="${HEIGHT - 16}">Less</text>${legend}<text x="${legendX + 34 + 5 * STEP + 4}" y="${HEIGHT - 16}">More</text>
</svg>
`;
writeFileSync("assets/heatmap.svg", svg);
console.log(`assets/heatmap.svg written: ${days.length} days, ${total} contributions`);

// Keep the "Activity" line on the info card in step with the heatmap.
const info = readFileSync("assets/info.svg", "utf8").replace(
  /(<tspan x="112" id="contrib">)[^<]*(<\/tspan>)/,
  `$1${total} contribution${total === 1 ? "" : "s"} in the last year$2`,
);
writeFileSync("assets/info.svg", info);
