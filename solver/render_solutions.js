"use strict";

const fs = require("fs");
const path = require("path");
const { simplifyPoly, ccw } = require("./pieces.js");

const GRID = 12;
const COLORS = ["#E53935", "#D81B60", "#8E24AA", "#5E35B1", "#3949AB",
                "#1E88E5", "#00897B", "#43A047", "#C0CA33", "#F4511E",
                "#FDD835", "#FB8C00", "#6D4C41", "#546E7A"];
const BG = "#f5f2ea";
const GRID_LINE = "#c9c9c9";
const BOARD_LINE = "#333";
const PIECE_STROKE = "#222";

const DIHEDRAL = [
    (x, y) => [x, y],
    (x, y) => [12 - y, x],
    (x, y) => [12 - x, 12 - y],
    (x, y) => [y, 12 - x],
    (x, y) => [12 - x, y],
    (x, y) => [x, 12 - y],
    (x, y) => [y, x],
    (x, y) => [12 - y, 12 - x]
];

function canonPoly(poly) {
    const p = ccw(simplifyPoly(poly));
    const n = p.length;
    let best = null;
    for (let dir = 0; dir < 2; dir++) {
        for (let start = 0; start < n; start++) {
            const seq = [];
            for (let k = 0; k < n; k++) {
                const idx = dir === 0 ? (start + k) % n : (start - k + n) % n;
                seq.push(p[idx]);
            }
            const key = JSON.stringify(seq);
            if (best === null || key < best) best = key;
        }
    }
    return best;
}

function unlabeledKey(sol) {
    let best = null;
    for (const t of DIHEDRAL) {
        const polys = sol.map(s => canonPoly(s.vertices.map(([x, y]) => t(x, y)))).sort();
        const key = JSON.stringify(polys);
        if (best === null || key < best) best = key;
    }
    return best;
}

const CELL = 22;
const M = 18;
const W = M * 2 + GRID * CELL;
const SX = x => (M + x * CELL).toFixed(2);
const SY = y => (M + y * CELL).toFixed(2);

function polyPoints(vertices) {
    return vertices.map(([x, y]) => SX(x) + "," + SY(y)).join(" ");
}

function renderSVG(sol) {
    const g = [];
    g.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">`);
    g.push(`  <rect x="0" y="0" width="${W}" height="${W}" fill="${BG}"/>`);
    for (const { piece, vertices } of sol) {
        const idx = piece.charCodeAt(0) - 65;
        g.push(`  <polygon points="${polyPoints(vertices)}" fill="${COLORS[idx]}" stroke="${PIECE_STROKE}" stroke-width="1" stroke-linejoin="round"/>`);
    }
    for (let i = 1; i < GRID; i++) {
        const v = SX(i);
        g.push(`  <line x1="${v}" y1="${SX(0)}" x2="${v}" y2="${SX(GRID)}" stroke="${GRID_LINE}" stroke-width="1"/>`);
        g.push(`  <line x1="${SX(0)}" y1="${v}" x2="${SX(GRID)}" y2="${v}" stroke="${GRID_LINE}" stroke-width="1"/>`);
    }
    g.push(`  <rect x="${SX(0)}" y="${SX(0)}" width="${CELL * GRID}" height="${CELL * GRID}" fill="none" stroke="${BOARD_LINE}" stroke-width="1.5"/>`);
    g.push(`</svg>`);
    return g.join("\n");
}

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "solutions.json"), "utf8"));

const seen = new Map();
for (const sol of data.solutions) {
    const key = unlabeledKey(sol);
    if (!seen.has(key)) seen.set(key, sol);
}
const unique = [...seen.values()];
console.log(`unlabeled distinct: ${unique.length} (expected ${data.unlabeledDistinct})`);
if (unique.length !== data.unlabeledDistinct) {
    console.error("FATAL: unlabeled dedup mismatch");
    process.exit(1);
}

const outDir = path.join(__dirname, "gallery");
fs.mkdirSync(outDir, { recursive: true });

const cells = [];
unique.forEach((sol, i) => {
    const svg = renderSVG(sol);
    const n = String(i + 1).padStart(4, "0");
    fs.writeFileSync(path.join(outDir, `solutions_unlabeled_${n}.svg`), svg);
    cells.push(`<div class="cell"><div class="num">${i + 1} / ${unique.length}</div>${svg}</div>`);
});

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Ostomachion &mdash; ${unique.length} unlabeled solutions</title>
<style>
    body { background:#f5f2ea; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; margin:0; padding:16px; }
    h1 { font-weight:300; color:#444; margin:4px 0 4px 4px; }
    p.sub { color:#8a8070; margin:0 0 16px 4px; }
    .grid { display:flex; flex-wrap:wrap; gap:12px; }
    .cell { background:#fff; border:1px solid #d8d2c2; padding:8px; }
    .num { font-size:12px; color:#8a8070; text-align:center; padding-bottom:6px; }
    svg { display:block; }
</style>
</head>
<body>
<h1>Ostomachion &mdash; ${unique.length} unlabeled solutions</h1>
<p class="sub">Each tiling drawn on the 12&times;12 grid; congruent pieces D/E and J/K treated as interchangeable; mirrors and rotations merged.</p>
<div class="grid">
${cells.join("\n")}
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`wrote ${unique.length} SVGs + index.html to ${outDir}`);
