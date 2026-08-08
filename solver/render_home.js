"use strict";

const fs = require("fs");
const path = require("path");
const { PIECE_V, PIECE_NAMES, area } = require("./pieces.js");

const GRID = 12;
const CELL = 26;
const M = 20;
const W = M * 2 + GRID * CELL;
const SX = x => (M + x * CELL).toFixed(2);
const SY = y => (M + y * CELL).toFixed(2);
const COLORS = ["#E53935", "#D81B60", "#8E24AA", "#5E35B1", "#3949AB",
                "#1E88E5", "#00897B", "#43A047", "#C0CA33", "#F4511E",
                "#FDD835", "#FB8C00", "#6D4C41", "#546E7A"];
const BG = "#f5f2ea";
const GRID_LINE = "#d8d2c2";
const BOARD_LINE = "#333";
const PIECE_STROKE = "#222";

function polyPoints(vertices) {
    return vertices.map(([x, y]) => SX(x) + "," + SY(y)).join(" ");
}

function pip(x, y, poly) {
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if ((yj - yi) * (x - xi) === (xj - xi) * (y - yi) &&
                x >= Math.min(xi, xj) && x <= Math.max(xi, xj) &&
                y >= Math.min(yi, yj) && y <= Math.max(yi, yj))
            return false;
        if ((yi > y) !== (yj > y)) {
            const xint = (xj - xi) * (y - yi) / (yj - yi) + xi;
            if (x < xint) inside = !inside;
        }
    }
    return inside;
}

function polyBBox(vertices) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of vertices) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
    }
    return [minx, miny, maxx, maxy];
}

function dotMarkers(vertices) {
    const bb = polyBBox(vertices);
    const x0 = Math.max(0, Math.ceil(bb[0] - 0.5));
    const x1 = Math.min(11, Math.floor(bb[2] - 0.5));
    const y0 = Math.max(0, Math.ceil(bb[1] - 0.5));
    const y1 = Math.min(11, Math.floor(bb[3] - 0.5));
    const out = [];
    for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
            const px = cx + 0.5, py = cy + 0.5;
            if (pip(px, py, vertices)) out.push([px, py]);
        }
    }
    return out;
}

function labelPoint(vertices) {
    const n = vertices.length;
    let A = 0, cx = 0, cy = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = vertices[i][0], yi = vertices[i][1];
        const xj = vertices[j][0], yj = vertices[j][1];
        const cross = xi * yj - xj * yi;
        A += cross;
        cx += (xi + xj) * cross;
        cy += (yi + yj) * cross;
    }
    cx /= 3 * A;
    cy /= 3 * A;
    let best = null, bestD = Infinity;
    for (const [px, py] of dotMarkers(vertices)) {
        const d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (d < bestD) { bestD = d; best = [px, py]; }
    }
    return best || [cx, cy];
}

function heroSVG(pieces, names) {
    const g = [];
    g.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" role="img" aria-label="The canonical 12 by 12 Ostomachion square, divided into its 14 pieces">`);
    g.push(`  <rect x="0" y="0" width="${W}" height="${W}" fill="${BG}"/>`);
    for (let i = 0; i < pieces.length; i++) {
        const verts = pieces[i];
        const [lx, ly] = labelPoint(verts);
        g.push(`  <polygon points="${polyPoints(verts)}" fill="${COLORS[i]}" stroke="${PIECE_STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`);
        g.push(`  <text x="${SX(lx)}" y="${SY(ly)}" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:24px;font-weight:bold;text-anchor:middle;dominant-baseline:central;fill:#fff;stroke:#222;stroke-width:4px;paint-order:stroke;" aria-hidden="true">${names[i]}</text>`);
    }
    for (let i = 1; i < GRID; i++) {
        const v = SX(i);
        g.push(`  <line x1="${v}" y1="${SX(0)}" x2="${v}" y2="${SX(GRID)}" stroke="${GRID_LINE}" stroke-width="1"/>`);
        g.push(`  <line x1="${SX(0)}" y1="${v}" x2="${SX(GRID)}" y2="${v}" stroke="${GRID_LINE}" stroke-width="1"/>`);
    }
    g.push(`  <rect x="${SX(0)}" y="${SX(0)}" width="${CELL * GRID}" height="${CELL * GRID}" fill="none" stroke="${BOARD_LINE}" stroke-width="2"/>`);
    g.push(`</svg>`);
    return g.join("\n");
}

function pieceRows() {
    return PIECE_V.map((verts, i) =>
        `<div class="plcell"><span class="pl" style="background:${COLORS[i]}">${PIECE_NAMES[i]}</span><span class="pa">${area(verts)}</span></div>`).join("\n");
}

function readData(config) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, config === "classic" ? "solutions.json" : `solutions_${config}.json`), "utf8"));
}

function readCounts() {
    const classic = readData("classic");
    const simple = readData("simple");
    return {
        classic: { pieces: classic.pieces.length, raw: classic.rawCount, labeled: classic.labeledDistinct, unlabeled: classic.unlabeledDistinct, reps: classic.solutions.length },
        simple: { pieces: simple.pieces.length, raw: simple.rawCount, labeled: simple.labeledDistinct, unlabeled: simple.unlabeledDistinct, reps: simple.solutions.length }
    };
}

const counts = readCounts();

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ostomachion &mdash; the world&rsquo;s oldest puzzle, solved and catalogued</title>
<style>
    body { background:#f5f2ea; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; margin:0; color:#333; line-height:1.55; }
    .wrap { max-width:980px; margin:0 auto; padding:28px 20px 60px; }
    header.hero { text-align:center; padding:10px 0 26px; }
    header.hero h1 { font-weight:300; font-size:44px; color:#444; margin:0 0 6px; letter-spacing:1px; }
    header.hero p.tagline { color:#8a8070; font-size:17px; margin:0; }
    .stage { display:flex; gap:34px; align-items:center; justify-content:center; flex-wrap:wrap; margin:18px 0 8px; }
    .stage svg { display:block; width:380px; height:380px; border:1px solid #d8d2c2; background:#fff; padding:10px; }
    .stage .side { max-width:420px; text-align:left; }
    .stage .side h2 { font-weight:300; color:#444; font-size:22px; margin:0 0 8px; }
    .stage .side p { margin:0 0 10px; color:#555; }
    .legend { text-align:center; font-size:13px; color:#8a8070; margin:4px 0 0; }
    .legend .lrow { display:flex; flex-wrap:wrap; justify-content:center; margin-top:10px; }
    .legend .plcell { display:flex; flex-direction:column; align-items:center; gap:2px; width:24px; }
    .legend .pl { width:24px; height:24px; color:#fff; font-weight:bold; line-height:24px; border:1px solid #d8d2c2; }
    .legend .pa { color:#555; font-size:12px; }
    .cards { display:flex; gap:20px; justify-content:center; margin:34px 0 40px; flex-wrap:wrap; }
    .card { flex:1 1 300px; max-width:460px; background:#fff; border:1px solid #d8d2c2; padding:22px 26px; text-decoration:none; color:inherit; display:block; transition:box-shadow .15s; }
    .card:hover { box-shadow:0 3px 12px rgba(0,0,0,.12); }
    .card .kicker { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#BC8932; }
    .card h3 { font-weight:300; color:#444; font-size:26px; margin:6px 0 8px; }
    .card p { margin:0; color:#666; font-size:14px; }
    .card .go { display:inline-block; margin-top:14px; color:#BC8932; font-weight:bold; font-size:15px; }
    section { margin:0 0 34px; }
    section h2 { font-weight:300; color:#444; font-size:26px; margin:0 0 10px; }
    section h3 { font-weight:300; color:#444; font-size:19px; margin:22px 0 6px; }
    section p, section li { color:#555; }
    section ul { margin:8px 0; padding-left:22px; }
    .muted { color:#8a8070; }
    .tablewrap { overflow-x:auto; }
    table.cmp { border-collapse:collapse; margin:10px 0; min-width:560px; }
    table.cmp th, table.cmp td { border:1px solid #d8d2c2; padding:6px 12px; text-align:center; font-size:14px; }
    table.cmp th { background:#ece6d8; color:#444; font-weight:normal; }
    table.cmp td { background:#fff; }
    table.cmp td.hl { background:#fdf6e3; }
    .links a { color:#BC8932; text-decoration:none; }
    .links a:hover { text-decoration:underline; }
    footer { border-top:1px solid #d8d2c2; margin-top:20px; padding-top:14px; color:#8a8070; font-size:13px; }
    footer a { color:#BC8932; }
    @media (max-width:700px) {
        .stage svg { width:260px; height:260px; }
        header.hero h1 { font-size:34px; }
    }
</style>
</head>
<body>
<div class="wrap">

<header class="hero">
    <h1>Ostomachion</h1>
    <p class="tagline">The world&rsquo;s oldest puzzle &mdash; Archimedes&rsquo; 14-piece dissection of the square, solved and catalogued</p>
</header>

<div class="stage">
    <div class="figure">
        ${heroSVG(PIECE_V, PIECE_NAMES)}
        <div class="legend">Piece areas (grid units of 1):<div class="lrow">
${pieceRows()}
        </div></div>
    </div>
    <div class="side">
        <h2>What you are looking at</h2>
        <p>The Ostomachion &mdash; from the Greek <i>osto</i> (bone) and <i>m&aacute;chi</i> (battle), literally a &ldquo;battle of the bones&rdquo; &mdash; is a dissection puzzle attributed to Archimedes of Syracuse (c.&thinsp;287&ndash;212&nbsp;BC). Fourteen pieces of 11 different shapes tile a 12&times;12 square of area 144.</p>
        <p>This project enumerates every way the pieces can be reassembled into the square, classifies the solutions, and visualizes them all.</p>
    </div>
</div>

<div class="cards">
    <a class="card" href="gallery/index.html">
        <span class="kicker">Browse the solutions</span>
        <h3>Classic game &mdash; 14 pieces</h3>
        <p>All ${counts.classic.unlabeled} distinct tilings of the square with the full Archimedes set, plus mirror-flip statistics and spanning-cut cases.</p>
        <span class="go">Open the classic gallery &rarr;</span>
    </a>
    <a class="card" href="gallery_simple/index.html">
        <span class="kicker">Browse the solutions</span>
        <h3>Simple game &mdash; 11 pieces</h3>
        <p>The three pairs that always travel together (I+L, J+M, K+N) are fused into composite pieces, leaving ${counts.simple.unlabeled} distinct tilings.</p>
        <span class="go">Open the simple gallery &rarr;</span>
    </a>
</div>

<section>
    <h2>History</h2>
    <p>The Stomachion, also called the <i>loculus Archimedius</i> (&ldquo;Archimedes&rsquo; box&rdquo;), is one of the oldest known puzzles. It is described in fragmentary ancient texts and in a treatise attributed to Archimedes. The only surviving copy of the treatise is a single page of the <b>Archimedes Palimpsest</b> &mdash; a Byzantine parchment manuscript from the 10th century that was scraped clean in the 13th century so that the pages could be reused for a prayer book. The faint underlying text was recovered in the 20th century, and modern multispectral imaging let scholars read it fully.</p>
    <p>The puzzle itself consists of 14 flat pieces &mdash; 7 triangles, 5 quadrilaterals and 2 pentagons &mdash; whose corners lie on a 12&times;12 grid. The aim is to rearrange them into a square. Ancient writers (Ausonius and others) compared it to juggling poetic meters, and it was long regarded as a playful pastime.</p>
    <p>The puzzle is notable mathematically because two pairs of pieces are congruent triangles (A/B and D/E), so any count of solutions must decide whether swapping them counts as a new solution. Three further pairs (I+L, J+M, K+N) always appear fused together in every tiling of the square &mdash; a fact this project proves exhaustively in <a class="links" href="forced_pairs.md">forced_pairs.md</a>.</p>
</section>

<section>
    <h2>How many solutions?</h2>
    <p>The exact count was first computed in 2003 by <b>Bill Cutler</b>: <b>17,152</b> arrangements in total, of which <b>536</b> are geometrically distinct once rotations, reflections and swaps of the congruent triangles are identified. The counts here were reproduced independently by this project&rsquo;s own exact-cover solver.</p>
    <div class="tablewrap">
    <table class="cmp">
        <tr><th>game</th><th>pieces</th><th>arrangements<br>(all symmetries)</th><th>distinct tilings<br>(labels kept)</th><th>distinct tilings<br>(unlabeled)</th></tr>
        <tr><td class="hl">classic</td><td class="hl">14</td><td class="hl">${counts.classic.raw}</td><td class="hl">${counts.classic.labeled}</td><td class="hl">${counts.classic.unlabeled}</td></tr>
        <tr><td>simple</td><td>11</td><td>${counts.simple.raw}</td><td>${counts.simple.labeled}</td><td>${counts.simple.unlabeled}</td></tr>
    </table>
    </div>
    <p class="muted">&ldquo;Unlabeled&rdquo; treats the congruent triangles A/B and D/E (and, in the simple game, G/K) as interchangeable and identifies mirror images and rotations. The simple game is exactly Cutler&rsquo;s reduced 11-piece &ldquo;Stomach&rdquo;: half of 536, because the third congruent pair halves the count again.</p>
</section>

<section>
    <h2>What we did here</h2>
    <ul>
        <li>Built an <b>exact-cover solver</b> (<code>count_solutions.js</code>) that enumerates every tiling of the 12&times;12 square, using big-integer arithmetic on the arrangement of all piece edges. It finds all ${counts.classic.raw} arrangements in a few minutes and reports the four counting conventions above.</li>
        <li>Proved the three fused pairs by brute force: in all ${counts.classic.reps} solutions of the classic game, the pieces I&ndash;L, J&ndash;M and K&ndash;N always appear together and share an edge.</li>
        <li>Recorded, for every solution, <b>which pieces are mirror-flipped</b> (a piece is &ldquo;flipped&rdquo; when the tiling uses its mirror image), and <b>which maximal cut-lines cross the whole board</b> (spanning cuts).</li>
        <li>Generated complete visual galleries for both games: every distinct tiling as an SVG, a flip table, and the spanning-cut case analysis.</li>
    </ul>
    <p class="muted">Rendering and solving code lives in <code>solver/</code>; the interactive drag-and-drop puzzle is in <code>site/</code>.</p>
</section>

<div class="links">
    <p><a href="gallery/index.html">Classic gallery (${counts.classic.unlabeled} solutions)</a> &middot; <a href="gallery/flips.html">classic flip table</a> &middot; <a href="gallery/cases.html">classic spanning-cut cases</a></p>
    <p><a href="gallery_simple/index.html">Simple gallery (${counts.simple.unlabeled} solutions)</a> &middot; <a href="gallery_simple/flips.html">simple flip table</a> &middot; <a href="gallery_simple/cases.html">simple spanning-cut cases</a></p>
</div>

<footer>
    <p>Ostomachion &middot; solver and galleries generated by scripts in <code>solver/</code> &middot; interactive puzzle: <a href="../site/index.html">play it in the browser</a></p>
</footer>

</div>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("wrote solver/index.html");
