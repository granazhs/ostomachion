"use strict";

const fs = require("fs");
const path = require("path");
const { simplifyPoly, ccw, PIECE_V, PIECE_NAMES, congruentPairs } = require("./pieces.js");

const GRID = 12;
const LETTERS = PIECE_NAMES.join("");
const NAME_IDX = new Map(PIECE_NAMES.map((n, i) => [n, i]));
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

function rot90(v) {
    return [-v[1], v[0]];
}

function orientPoly(verts, rot, flip) {
    let p = verts.map(v => v.slice());
    for (let r = 0; r < rot; r++) p = p.map(rot90);
    if (flip) p = p.map(v => [-v[0], v[1]]);
    return p;
}

function pieceIsFlipped(piece, placed) {
    const canon = PIECE_V[NAME_IDX.get(piece)];
    for (let flip = 0; flip <= 1; flip++) {
        for (let rot = 0; rot < 4; rot++) {
            const p = orientPoly(canon, rot, flip);
            const tx = placed[0][0] - p[0][0];
            const ty = placed[0][1] - p[0][1];
            let ok = true;
            for (let i = 0; i < p.length; i++) {
                if (p[i][0] + tx !== placed[i][0] || p[i][1] + ty !== placed[i][1]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return flip === 1;
        }
    }
    throw new Error("no orientation match for piece " + piece);
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

const DOT_R = 2.0;

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
            if (pip(px, py, vertices)) out.push([px, py, DOT_R]);
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

const LABEL_STYLE = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:bold;text-anchor:middle;dominant-baseline:central;fill:#fff;stroke:#222;stroke-width:3px;paint-order:stroke;";

function renderSVG(sol, flags, labeled) {
    const g = [];
    const labels = [];
    g.push(`<svg xmlns="http://www.w3.org/2000/svg" data-board="1" data-m="${M}" data-cell="${CELL}" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">`);
    g.push(`  <rect x="0" y="0" width="${W}" height="${W}" fill="${BG}"/>`);
    for (const { piece, vertices } of sol) {
        const idx = NAME_IDX.get(piece);
        const [lx, ly] = labelPoint(vertices);
        g.push(`  <polygon points="${polyPoints(vertices)}" fill="${COLORS[idx]}" data-piece="${piece}" data-color="${COLORS[idx]}" data-lx="${lx.toFixed(2)}" data-ly="${ly.toFixed(2)}" stroke="${PIECE_STROKE}" stroke-width="1" stroke-linejoin="round"/>`);
        if (flags[idx]) {
            for (const [dx, dy, r] of dotMarkers(vertices))
                g.push(`  <circle cx="${SX(dx)}" cy="${SY(dy)}" r="${r.toFixed(2)}" fill="#222"/>`);
        }
        if (labeled)
            labels.push(`  <text x="${SX(lx)}" y="${SY(ly)}" style="${LABEL_STYLE}" data-label="1">${piece}</text>`);
    }
    for (let i = 1; i < GRID; i++) {
        const v = SX(i);
        g.push(`  <line x1="${v}" y1="${SX(0)}" x2="${v}" y2="${SX(GRID)}" stroke="${GRID_LINE}" stroke-width="1"/>`);
        g.push(`  <line x1="${SX(0)}" y1="${v}" x2="${SX(GRID)}" y2="${v}" stroke="${GRID_LINE}" stroke-width="1"/>`);
    }
    g.push(`  <rect x="${SX(0)}" y="${SX(0)}" width="${CELL * GRID}" height="${CELL * GRID}" fill="none" stroke="${BOARD_LINE}" stroke-width="1.5"/>`);
    g.push(labels.join("\n"));
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

const flipBySol = new Map();
const flipTotals = new Array(14).fill(0);
for (const sol of unique) {
    const flags = new Array(14).fill(false);
    for (const { piece, vertices } of sol) {
        const idx = NAME_IDX.get(piece);
        flags[idx] = pieceIsFlipped(piece, vertices);
    }
    flipBySol.set(sol, flags);
    flags.forEach((f, j) => { if (f) flipTotals[j]++; });
}

const outDir = path.join(__dirname, "gallery");
fs.mkdirSync(outDir, { recursive: true });

const cells = [];
unique.forEach((sol, i) => {
    const flags = flipBySol.get(sol);
    const n = String(i + 1).padStart(4, "0");
    fs.writeFileSync(path.join(outDir, `solutions_unlabeled_${n}.svg`), renderSVG(sol, flags));
    fs.writeFileSync(path.join(outDir, `solutions_labeled_${n}.svg`), renderSVG(sol, flags, true));
    cells.push(`<div class="cell"><div class="num">${i + 1} / ${unique.length}</div>${renderSVG(sol, flags)}</div>`);
});

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Ostomachion &mdash; ${unique.length} unlabeled solutions</title>
<style>
    body { background:#f5f2ea; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; margin:0; padding:16px; }
    h1 { font-weight:300; color:#444; margin:4px 0 4px 4px; }
    p.sub { color:#8a8070; margin:0 0 12px 4px; }
    #pkeys { display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin:0 0 16px 4px; }
    #pkeys button { border:none; cursor:pointer; width:30px; height:30px; font-size:15px;
        background:#444; color:#fff; padding:0; line-height:30px; }
    #pkeys button.wide { width:auto; padding:0 10px; }
    #pkeys button.active { background:#BC8932; }
    .grid { display:flex; flex-wrap:wrap; gap:12px; }
    .cell { background:#fff; border:1px solid #d8d2c2; padding:8px; }
    .num { font-size:12px; color:#8a8070; text-align:center; padding-bottom:6px; }
    svg { display:block; }
    #orientations { display:none; margin-top:18px; }
    #orientations .otitle { font-size:15px; color:#444; font-weight:300; margin:0 0 8px 4px; }
    #orientations .ogrid { display:flex; flex-wrap:wrap; gap:8px; }
    #orientations .ocell { background:#fff; border:1px solid #d8d2c2; padding:4px; }
    #orientations .ocap { font-size:11px; color:#8a8070; text-align:center; padding-top:2px; }
    #orientations .ocap b { color:#b03a2e; font-weight:normal; }
</style>
</head>
<body>
<h1>Ostomachion &mdash; ${unique.length} unlabeled solutions</h1>
<p class="sub">Each tiling drawn on the 12&times;12 grid; congruent pieces ${congruentPairs().map(([a, b]) => `${PIECE_NAMES[a]}/${PIECE_NAMES[b]}`).join(" and ")} treated as interchangeable; mirrors and rotations merged. Dots mark mirror-flipped pieces. Click letters to toggle pieces on or off across every tiling (several can be on at once); \u201cAll\u201d toggles between all and none. Piece orientations are shown while exactly one piece is selected. <a href="flips.html">Flip table</a> &middot; <a href="cases.html">Spanning-cut cases</a> &middot; <a href="cases_all.html">all diagonals</a></p>
<div id="pkeys">
    <button class="wide" data-pk="all">All</button>
    ${PIECE_NAMES.map(n => `<button data-pk="${n}">${n}</button>`).join("")}
</div>
<div id="orientations"></div>
<div class="grid">
${cells.join("\n")}
</div>
<script>
    var btns = document.querySelectorAll("#pkeys button");
    var OCELL = 22, OMARGIN = 18;
    var activePieces = {};
    var mode = "all";
    function setPieces() {
        var polys = document.querySelectorAll(".cell polygon");
        for (var i = 0; i < polys.length; i++) {
            var piece = polys[i].getAttribute("data-piece");
            var show = mode === "all" || (mode === "subset" && activePieces[piece]);
            polys[i].setAttribute("fill",
                show ? polys[i].getAttribute("data-color") : "rgba(0,0,0,0)");
        }
        for (var j = 0; j < btns.length; j++) {
            var pk = btns[j].getAttribute("data-pk");
            btns[j].classList.toggle("active", pk === "all" ? mode === "all" : !!activePieces[pk]);
        }
    }
    function collectOrientations(pk) {
        var out = {};
        var cells = document.querySelectorAll(".cell");
        for (var i = 0; i < cells.length; i++) {
            var svg = cells[i].querySelector("svg");
            if (!svg) continue;
            var kids = svg.children;
            var cur = null;
            for (var k = 0; k < kids.length; k++) {
                var el = kids[k];
                if (el.tagName === "polygon") {
                    if (cur) addOrientation(out, cur);
                    cur = { piece: el.getAttribute("data-piece"), verts: [], dots: [] };
                    var pts = el.getAttribute("points").trim().split(/\\s+/);
                    for (var p = 0; p < pts.length; p++) {
                        var c = pts[p].split(",");
                        cur.verts.push([(+c[0] - OMARGIN) / OCELL, (+c[1] - OMARGIN) / OCELL]);
                    }
                } else if (el.tagName === "circle" && cur) {
                    cur.dots.push([(+el.getAttribute("cx") - OMARGIN) / OCELL, (+el.getAttribute("cy") - OMARGIN) / OCELL]);
                }
            }
            if (cur) addOrientation(out, cur);
        }
        return out;
    }
    function addOrientation(out, cur) {
        if (cur.piece === "all" || cur.piece === null) return;
        var minx = Infinity, miny = Infinity;
        for (var i = 0; i < cur.verts.length; i++) {
            if (cur.verts[i][0] < minx) minx = cur.verts[i][0];
            if (cur.verts[i][1] < miny) miny = cur.verts[i][1];
        }
        var norm = [], dots = [];
        for (var j = 0; j < cur.verts.length; j++) norm.push([cur.verts[j][0] - minx, cur.verts[j][1] - miny]);
        for (var d = 0; d < cur.dots.length; d++) dots.push([cur.dots[d][0] - minx, cur.dots[d][1] - miny]);
        var key = JSON.stringify(norm.slice().sort(function(a, b) { return a[0] - b[0] || a[1] - b[1]; }));
        if (!out[cur.piece]) out[cur.piece] = {};
        var entry = out[cur.piece][key];
        if (!entry) out[cur.piece][key] = { piece: cur.piece, verts: norm, dots: dots, count: 1 };
        else entry.count++;
    }
    function renderOrientationSvg(o, color) {
        var cell = 20, pad = 6;
        var maxx = 0, maxy = 0;
        for (var i = 0; i < o.verts.length; i++) {
            if (o.verts[i][0] > maxx) maxx = o.verts[i][0];
            if (o.verts[i][1] > maxy) maxy = o.verts[i][1];
        }
        var w = pad * 2 + (maxx + 1) * cell, h = pad * 2 + (maxy + 1) * cell;
        var g = ['<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'];
        g.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#f5f2ea"/>');
        for (var gx = 0; gx <= maxx + 1; gx++)
            g.push('<line x1="' + (pad + gx * cell) + '" y1="' + pad + '" x2="' + (pad + gx * cell) + '" y2="' + (pad + (maxy + 1) * cell) + '" stroke="#c9c9c9" stroke-width="1"/>');
        for (var gy = 0; gy <= maxy + 1; gy++)
            g.push('<line x1="' + pad + '" y1="' + (pad + gy * cell) + '" x2="' + (pad + (maxx + 1) * cell) + '" y2="' + (pad + gy * cell) + '" stroke="#c9c9c9" stroke-width="1"/>');
        g.push('<polygon points="' + o.verts.map(function(v) { return (pad + v[0] * cell).toFixed(1) + "," + (pad + v[1] * cell).toFixed(1); }).join(" ") + '" fill="' + color + '" stroke="#222" stroke-width="1.5" stroke-linejoin="round"/>');
        for (var i2 = 0; i2 < o.dots.length; i2++)
            g.push('<circle cx="' + (pad + o.dots[i2][0] * cell).toFixed(1) + '" cy="' + (pad + o.dots[i2][1] * cell).toFixed(1) + '" r="2" fill="#222"/>');
        g.push('</svg>');
        return g.join("");
    }
    function showOrientations(pk) {
        var box = document.getElementById("orientations");
        var count = 0;
        for (var k in activePieces) if (activePieces[k]) count++;
        if (mode !== "subset" || count !== 1 || !activePieces[pk]) {
            box.innerHTML = "";
            box.style.display = "none";
            return;
        }
        var colorEl = document.querySelector(".cell polygon[data-piece=\\"" + pk + "\\"]");
        var color = colorEl ? colorEl.getAttribute("data-color") : "#444";
        var all = collectOrientations(pk);
        var list = [];
        for (var key in all[pk]) list.push(all[pk][key]);
        list.sort(function(a, b) {
            var fa = a.dots.length ? 1 : 0, fb = b.dots.length ? 1 : 0;
            if (fa !== fb) return fa - fb;
            return b.count - a.count;
        });
        var h = ["<div class=\\"otitle\\">Orientations of " + pk + " (" + list.length + ")</div><div class=\\"ogrid\\">"];
        for (var i = 0; i < list.length; i++) {
            var o = list[i];
            h.push("<div class=\\"ocell\\">" + renderOrientationSvg(o, color) +
                "<div class=\\"ocap\\">" + (o.dots.length ? "<b>flipped</b> " : "") + "&times;" + o.count + "</div></div>");
        }
        h.push("</div>");
        box.innerHTML = h.join("");
        box.style.display = "block";
    }
    for (var k = 0; k < btns.length; k++) {
        (function(btn) {
            btn.addEventListener("click", function() {
                var pk = btn.getAttribute("data-pk");
                if (pk === "all") {
                    mode = mode === "all" ? "none" : "all";
                    activePieces = {};
                } else {
                    if (mode !== "subset") activePieces = {};
                    if (activePieces[pk]) delete activePieces[pk];
                    else activePieces[pk] = true;
                    var count = 0;
                    for (var k in activePieces) if (activePieces[k]) count++;
                    mode = count === 0 ? "all" : "subset";
                }
                setPieces();
                showOrientations(pk);
            });
        })(btns[k]);
    }
    setPieces();
</script>
<script src="labels.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`wrote ${unique.length} SVGs + index.html to ${outDir}`);

function renderFlipTable() {
    const totalFlips = flipTotals.reduce((a, b) => a + b, 0);

    const headCells = ["<th class=\"thnum\">#</th><th class=\"thnum\">Flips</th>"];
    for (let j = 0; j < 14; j++) {
        headCells.push(`<th class="pcol" title="click to show only solutions where piece ${LETTERS[j]} is flipped">${LETTERS[j]}</th>`);
    }
    const rows = [];
    unique.forEach((sol, i) => {
        const flags = flipBySol.get(sol);
        const nFlips = flags.reduce((a, b) => a + b, 0);
        const n = String(i + 1).padStart(4, "0");
        const cells = flags.map((f, j) =>
            `<td class="fcell ${f ? "f" : "n"}"${f ? ` style="background:${COLORS[j]}"` : ""} title="piece ${LETTERS[j]} ${f ? "flipped" : "not flipped"}"></td>`).join("");
        rows.push(`    <tr data-num="${i + 1}" data-flips="${nFlips}">
      <td class="num"><a href="solutions_unlabeled_${n}.svg" class="sollink" title="solution ${i + 1} \u2014 click to preview, ctrl+click to open">${i + 1}</a><img class="prev" loading="lazy" src="solutions_unlabeled_${n}.svg" alt="solution ${i + 1}"></td>
      <td class="num">${nFlips}</td>
      ${cells}
    </tr>`);
    });
    const footCells = [`<td class="num">\u03a3</td>`, `<td class="num">${totalFlips}</td>`];
    for (let j = 0; j < 14; j++) {
        footCells.push(`<td class="fcell tot" title="piece ${LETTERS[j]} flipped in ${flipTotals[j]} of ${unique.length} solutions">${flipTotals[j]}</td>`);
    }

    const sigOf = (sol) => {
        const flags = flipBySol.get(sol);
        let s = 0;
        for (let j = 0; j < 14; j++) if (flags[j]) s |= (1 << j);
        return s;
    };
    const groups = new Map();
    unique.forEach((sol, i) => {
        const s = sigOf(sol);
        if (!groups.has(s)) groups.set(s, []);
        groups.get(s).push(i + 1);
    });
    const distinct = groups.size;
    const dupGroups = [...groups.values()].filter(g => g.length > 1);
    const shared = dupGroups.reduce((a, g) => a + g.length, 0);

    const headCells2 = ["<th class=\"thnum\" title=\"number in the gallery (click a number to preview)\">#</th><th class=\"thnum\" title=\"how many solutions share this flip pattern\">dup</th><th class=\"thnum\">Flips</th>"];
    for (let j = 0; j < 14; j++) {
        headCells2.push(`<th class="pcol" title="piece ${LETTERS[j]}">${LETTERS[j]}</th>`);
    }
    const rows2 = [];
    const bits = (sig) => Array.from({ length: 14 }, (_, j) => ((sig >> j) & 1) ? "1" : "0").join("");
    const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);
    for (const [sig, members] of sortedGroups) {
        if (rows2.length > 0) {
            rows2.push(`    <tr class="gsep"><td colspan="17" title="signature ${bits(sig)} \u2014 same flip pattern as gallery solutions ${members.join(", ")}"><span class="gseplabel">${members.length} solution${members.length > 1 ? "s" : ""} &middot; ${bits(sig)}</span></td></tr>`);
        }
        for (const orig of members) {
            const flags = flipBySol.get(unique[orig - 1]);
            const nFlips = flags.reduce((a, b) => a + b, 0);
            const n = String(orig).padStart(4, "0");
            const cells = flags.map((f, j) =>
                `<td class="fcell ${f ? "f" : "n"}"${f ? ` style="background:${COLORS[j]}"` : ""} title="piece ${LETTERS[j]} ${f ? "flipped" : "not flipped"}"></td>`).join("");
            const dup = members.length > 1;
            const gCell = dup
                ? `<td class="g" title="same flip pattern as gallery solutions ${members.join(", ")}">&times;${members.length}</td>`
                : `<td class="g"></td>`;
            rows2.push(`    <tr class="${dup ? "dup" : ""}" data-flips="${nFlips}">
      <td class="num"><a href="solutions_unlabeled_${n}.svg" class="sollink" title="gallery solution ${orig} \u2014 click to preview, ctrl+click to open">${orig}</a><img class="prev" loading="lazy" src="solutions_unlabeled_${n}.svg" alt="gallery solution ${orig}"></td>
      ${gCell}
      <td class="num">${nFlips}</td>
      ${cells}
    </tr>`);
        }
    }
    const footCells2 = [`<td class="num">${unique.length}</td>`, `<td class="num" title="${distinct} distinct flip patterns, ${dupGroups.length} of them shared">${distinct}</td>`, `<td class="num">${totalFlips}</td>`];
    for (let j = 0; j < 14; j++) {
        footCells2.push(`<td class="fcell tot" title="piece ${LETTERS[j]} flipped in ${flipTotals[j]} of ${unique.length} solutions">${flipTotals[j]}</td>`);
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Ostomachion &mdash; flip table (${unique.length} solutions)</title>
<style>
    body { background:#f5f2ea; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; margin:0; padding:16px; }
    h1 { font-weight:300; color:#444; margin:4px 0 4px 4px; }
    p.sub { color:#8a8070; margin:0 0 12px 4px; max-width:980px; }
    a { color:#BC8932; }
    h2 { font-weight:300; color:#444; font-size:17px; margin:0 0 6px 4px; }
    #toolbar { margin:0 0 8px 4px; }
    #toolbar button { border:1px solid #b9ad97; background:#fff; color:#444; cursor:pointer; padding:4px 10px; border-radius:3px; }
    #toolbar span { color:#8a8070; font-size:13px; margin-left:10px; }
    .tables { display:flex; gap:20px; align-items:flex-start; overflow-x:auto; padding-bottom:8px; }
    .tcol { flex:1 1 0; min-width:0; }
    .tablewrap { overflow:auto; max-height:80vh; background:#fff; border:1px solid #d8d2c2; }
    table { border-collapse:collapse; font-size:13px; }
    thead th { position:sticky; top:0; z-index:2; background:#fff; border:1px solid #d8d2c2; padding:4px 2px; text-align:center; font-size:12px; color:#8a8070; }
    thead th.pcol { cursor:pointer; }
    #tab2 thead th { cursor:default; }
    thead th.pcol.active { background:#BC8932; color:#fff; }
    thead th.thnum { cursor:pointer; }
    thead th.sorted { background:#e7e0d0; color:#444; font-weight:bold; }
    tbody td, tfoot td { border:1px solid #e2ddcf; padding:0; height:16px; }
    td.fcell { width:24px; }
    td.fcell.n { background:#fbfaf5; }
    td.num { background:#f5f2ea; color:#8a8070; padding:2px 6px !important; width:44px; text-align:center; }
    td.num a { text-decoration:none; color:#8a8070; display:inline-block; }
    td.num.preview a { display:none; }
    td.num img.prev { display:none; width:168px; height:168px; border:1px solid #d8d2c2; }
    td.num.preview img.prev { display:block; }
    td.g { width:34px; background:#f5f2ea; color:#b03a2e; font-size:11px; text-align:center; }
    tr.dup td.n { background:#fdecea; }
    tr.dup td.g { background:#f9dcdc; }
    tr.dup td.num { background:#f7e8e6; }
    tr.gsep td { border-top:2px solid #a89e8a; border-bottom:1px solid #e2ddcf; background:#faf8f2; padding:1px 0; }
    tr.gsep .gseplabel { display:block; text-align:center; color:#8a8070; font-size:11px; letter-spacing:1px; }
    tfoot td { font-size:12px; color:#8a8070; text-align:center; }
    tfoot td.tot { background:#f5f2ea; }
</style>
</head>
<body>
<h1>Ostomachion &mdash; which pieces are mirror-flipped</h1>
<p class="sub">One row per solution (the ${unique.length} unlabeled distinct tilings shown in the <a href="index.html">gallery</a>), one column per piece. A cell filled with the piece&rsquo;s color means that piece is mirror-flipped in that solution; an empty cell means it is not. In the left table, click a piece letter to show only rows where it is flipped, click &ldquo;Flips&rdquo; to sort by flip count, and click a solution number to preview its tiling. The right table lists the same solutions grouped by flip pattern, most common patterns first; a horizontal line separates each pattern. Only ${distinct} of the ${unique.length} solutions have a distinct flip pattern: ${dupGroups.length} patterns are shared by ${shared} solutions, each marked with a &times;N badge and tinted rows. <a href="cases.html">Spanning-cut cases</a> &middot; <a href="cases_all.html">all diagonals</a></p>
<div class="tables">
<div class="tcol">
<h2>Gallery order</h2>
<div id="toolbar">
    <button id="reset">Reset</button>
    <span id="count"></span>
</div>
<div class="tablewrap">
<table id="tab1">
<thead>
  <tr>${headCells.join("")}</tr>
</thead>
<tbody>
${rows.join("\n")}
</tbody>
<tfoot>
  <tr>${footCells.join("")}</tr>
</tfoot>
</table>
</div>
</div>
<div class="tcol">
<h2>Sorted by flip pattern</h2>
<div id="toolbar">
    <span>${distinct} distinct patterns &middot; ${dupGroups.length} shared</span>
</div>
<div class="tablewrap">
<table id="tab2">
<thead>
  <tr>${headCells2.join("")}</tr>
</thead>
<tbody>
${rows2.join("\n")}
</tbody>
<tfoot>
  <tr>${footCells2.join("")}</tr>
</tfoot>
</table>
</div>
</div>
</div>
<script>
    (function() {
        var tbody = document.querySelector("#tab1 tbody");
        var origRows = Array.prototype.slice.call(tbody.rows);
        var ths = document.querySelectorAll("#tab1 thead th");
        var countEl = document.getElementById("count");
        var resetBtn = document.getElementById("reset");
        var state = { filter: null, sortKey: "num", asc: true };
        function thIndex(th) {
            var kids = th.parentNode.children;
            for (var i = 0; i < kids.length; i++) if (kids[i] === th) return i;
            return -1;
        }
        function apply() {
            var rows = Array.prototype.slice.call(origRows);
            if (state.sortKey === "flips") {
                rows.sort(function(a, b) {
                    var d = parseInt(a.getAttribute("data-flips"), 10) - parseInt(b.getAttribute("data-flips"), 10);
                    return state.asc ? d : -d;
                });
            }
            for (var i = 0; i < rows.length; i++) tbody.appendChild(rows[i]);
            var vis = 0;
            for (var j = 0; j < rows.length; j++) {
                var r = rows[j];
                var show = state.filter === null || r.children[state.filter + 2].classList.contains("f");
                r.style.display = show ? "" : "none";
                if (show) vis++;
            }
            countEl.textContent = vis + " of " + rows.length + " solutions";
            for (var k = 0; k < ths.length; k++) {
                ths[k].classList.toggle("active", state.filter !== null && k === state.filter + 2);
                ths[k].classList.toggle("sorted", state.sortKey === "flips" && k === 1);
            }
        }
        for (var m = 0; m < ths.length; m++) {
            (function(th) {
                th.addEventListener("click", function() {
                    var i = thIndex(th);
                    if (i === 1) {
                        state.sortKey = "flips";
                        state.asc = th.classList.contains("sorted") ? !state.asc : true;
                    } else if (i >= 2) {
                        var col = i - 2;
                        state.filter = state.filter === col ? null : col;
                    } else {
                        state = { filter: null, sortKey: "num", asc: true };
                    }
                    apply();
                });
            })(ths[m]);
        }
        resetBtn.addEventListener("click", function() {
            state = { filter: null, sortKey: "num", asc: true };
            apply();
        });
        document.addEventListener("click", function(e) {
            var el = e.target;
            if (el && el.className === "sollink") {
                e.preventDefault();
                el.parentNode.classList.toggle("preview");
            }
        });
        apply();
    })();
</script>
<script src="labels.js"></script>
</body>
</html>
`;
    fs.writeFileSync(path.join(outDir, "flips.html"), html);
    console.log(`wrote flips.html to ${outDir}`);
}

renderFlipTable();
