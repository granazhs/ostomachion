"use strict";

const fs = require("fs");
const path = require("path");
const { simplifyPoly, ccw } = require("./pieces.js");

const GRID = 12;
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

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

function canonD(dx, dy) {
    const g = gcd(Math.abs(dx), Math.abs(dy));
    let ux = dx / g, uy = dy / g;
    if (ux < 0 || (ux === 0 && uy < 0)) { ux = -ux; uy = -uy; }
    return [ux, uy];
}

function maximalSections(sol) {
    const edgeSet = new Set(), edges = [];
    for (const p of sol) {
        const verts = simplifyPoly(p.vertices);
        for (let i = 0; i < verts.length; i++) {
            const A = verts[i], B = verts[(i + 1) % verts.length];
            const onB = (A[0] === 0 && B[0] === 0) || (A[0] === 12 && B[0] === 12) ||
                (A[1] === 0 && B[1] === 0) || (A[1] === 12 && B[1] === 12);
            if (onB) continue;
            const k = [A, B].map(v => v.join(",")).sort().join("|");
            if (edgeSet.has(k)) continue;
            edgeSet.add(k); edges.push([A, B]);
        }
    }
    const lines = new Map();
    for (const [A, B] of edges) {
        const [ux, uy] = canonD(B[0] - A[0], B[1] - A[1]);
        const c = uy * A[0] - ux * A[1];
        const key = ux + "," + uy + "," + c;
        if (!lines.has(key)) lines.set(key, []);
        const ta = ux * A[0] + uy * A[1], tb = ux * B[0] + uy * B[1];
        lines.get(key).push({ t0: Math.min(ta, tb), t1: Math.max(ta, tb), P0: ta <= tb ? A : B, P1: ta <= tb ? B : A });
    }
    const secs = [];
    for (const ints of lines.values()) {
        ints.sort((a, b) => a.t0 - b.t0);
        let cur = { t0: ints[0].t0, t1: ints[0].t1, P0: ints[0].P0, P1: ints[0].P1 };
        for (let i = 1; i < ints.length; i++) {
            const it = ints[i];
            if (it.t0 <= cur.t1) {
                if (it.t1 > cur.t1) { cur.t1 = it.t1; cur.P1 = it.P1; }
            } else {
                secs.push(cur); cur = { t0: it.t0, t1: it.t1, P0: it.P0, P1: it.P1 };
            }
        }
        secs.push(cur);
    }
    return secs;
}

function chordPts(ux, uy, c) {
    const E = [[[0, 0], [12, 0]], [[12, 0], [12, 12]], [[12, 12], [0, 12]], [[0, 12], [0, 0]]];
    const pts = [];
    for (const [[x1, y1], [x2, y2]] of E) {
        const d1 = uy * x1 - ux * y1 - c, d2 = uy * x2 - ux * y2 - c;
        if (d1 === 0) pts.push([x1, y1]);
        else if (d2 === 0) pts.push([x2, y2]);
        else if ((d1 < 0 && d2 > 0) || (d1 > 0 && d2 < 0)) {
            const s = d1 / (d1 - d2);
            pts.push([x1 + (x2 - x1) * s, y1 + (y2 - y1) * s]);
        }
    }
    return pts;
}

function canonSegStr(P, Q) {
    let best = null;
    for (const t of DIHEDRAL) {
        const p1 = t(P[0], P[1]), p2 = t(Q[0], Q[1]);
        const s = [p1, p2].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(v => v.join(",")).join(";");
        if (best === null || s < best) best = s;
    }
    return best;
}

// returns array of actual spanning cut segments [{A,B}, ...]
function spanningSegs(sol) {
    const byLine = new Map();
    for (const sec of maximalSections(sol)) {
        const [ux, uy] = canonD(sec.P1[0] - sec.P0[0], sec.P1[1] - sec.P0[1]);
        const c = uy * sec.P0[0] - ux * sec.P0[1];
        const key = ux + "," + uy + "," + c;
        if (!byLine.has(key)) byLine.set(key, { ux, uy, c, t0: sec.t0, t1: sec.t1 });
        else {
            const L = byLine.get(key);
            L.t0 = Math.min(L.t0, sec.t0); L.t1 = Math.max(L.t1, sec.t1);
        }
    }
    const full = [];
    for (const L of byLine.values()) {
        const pts = chordPts(L.ux, L.uy, L.c);
        if (pts.length < 2) continue;
        const ts = pts.map(([x, y]) => L.ux * x + L.uy * y);
        const t0 = Math.min(...ts), t1 = Math.max(...ts);
        if (L.t0 <= t0 + 1e-9 && L.t1 >= t1 - 1e-9) {
            const A = pts.find(([x, y]) => Math.abs(L.ux * x + L.uy * y - t0) < 1e-9);
            const B = pts.find(([x, y]) => Math.abs(L.ux * x + L.uy * y - t1) < 1e-9);
            full.push({ A, B });
        }
    }
    return full;
}

function spanningCuts(sol) {
    return spanningSegs(sol).map(s => canonSegStr(s.A, s.B)).sort();
}

function nameChord(cs) {
    const m = {
        "0,6;12,6": "FULL MIDLINE",
        "0,0;12,6": "CORNER\u2192EDGE-MID DIAG (1/2)",
        "0,0;12,12": "MAIN DIAGONAL",
        "0,6;6,0": "45\u00b0 MIDPOINT DIAG",
        "0,3;6,0": "CORNER-REGION DIAG (1/2)"
    };
    return m[cs] || cs;
}

const CHORD_COLOR = {
    "FULL MIDLINE": "#444",
    "CORNER\u2192EDGE-MID DIAG (1/2)": "#1E88E5",
    "MAIN DIAGONAL": "#E53935",
    "45\u00b0 MIDPOINT DIAG": "#43A047",
    "CORNER-REGION DIAG (1/2)": "#FB8C00"
};
const chordColor = name => CHORD_COLOR[name] || "#6D4C41";

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "solutions.json"), "utf8"));

const seenG = new Map();
for (const sol of data.solutions) {
    const k = unlabeledKey(sol);
    if (!seenG.has(k)) seenG.set(k, sol);
}
const rows = [...seenG.values()];
console.log(`gallery rows (unlabeledKey): ${rows.length}`);

const cutsOf = new Map();
for (const s of rows) cutsOf.set(s, spanningCuts(s));

const groups = new Map();
for (const s of rows) {
    const cuts = cutsOf.get(s);
    const key = cuts.join("|");
    if (!groups.has(key)) groups.set(key, { n: 0, cuts });
    groups.get(key).n++;
}
const ordered = [...groups.entries()].sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
console.log(`cases over gallery rows: ${ordered.length} -> ${ordered.map(e => e[1].n).join(",")}`);

const rowCase = rows.map(s => ordered.findIndex(e => e[0] === cutsOf.get(s).join("|")) + 1);

// actual cut segments of a single representative solution per case (first gallery
// row): exactly the lines present in one real solution, so D8-symmetric
// duplicates never appear together.
const repRow = ordered.map(() => null);
rows.forEach((s, r) => {
    const c = rowCase[r];
    if (repRow[c - 1] === null) repRow[c - 1] = s;
});
const caseSegs = repRow.map(s => spanningSegs(s));

const outDir = path.join(__dirname, "gallery");

// diagram SVG for one case
function caseDiagram(segs) {
    const CELLD = 30, MD = 26, WD = MD * 2 + GRID * CELLD;
    const SXD = x => (MD + x * CELLD).toFixed(2);
    const SYD = y => (MD + y * CELLD).toFixed(2);
    const g = [];
    g.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WD}" height="${WD}" viewBox="0 0 ${WD} ${WD}">`);
    g.push(`  <rect x="0" y="0" width="${WD}" height="${WD}" fill="#faf8f2"/>`);
    for (let i = 1; i < GRID; i++) {
        g.push(`  <line x1="${SXD(i)}" y1="${SXD(0)}" x2="${SXD(i)}" y2="${SXD(GRID)}" stroke="#e3dfd3" stroke-width="1"/>`);
        g.push(`  <line x1="${SXD(0)}" y1="${SXD(i)}" x2="${SXD(GRID)}" y2="${SXD(i)}" stroke="#e3dfd3" stroke-width="1"/>`);
    }
    for (const { A, B } of segs) {
        const name = nameChord(canonSegStr(A, B));
        g.push(`  <line x1="${SXD(A[0])}" y1="${SYD(A[1])}" x2="${SXD(B[0])}" y2="${SYD(B[1])}" stroke="${chordColor(name)}" stroke-width="3" stroke-linecap="round" opacity="0.9"/>`);
        g.push(`  <circle cx="${SXD(A[0])}" cy="${SYD(A[1])}" r="4" fill="${chordColor(name)}" stroke="#fff" stroke-width="1"/>`);
        g.push(`  <circle cx="${SXD(B[0])}" cy="${SYD(B[1])}" r="4" fill="${chordColor(name)}" stroke="#fff" stroke-width="1"/>`);
    }
    g.push(`  <rect x="${SXD(0)}" y="${SXD(0)}" width="${CELLD * GRID}" height="${CELLD * GRID}" fill="none" stroke="#333" stroke-width="2"/>`);
    g.push(`</svg>`);
    return g.join("\n");
}

const blocks = [];
ordered.forEach(([key, info], i) => {
    const num = i + 1;
    const segList = caseSegs[i];
    const mult = {};
    for (const c of info.cuts) {
        const n = nameChord(c);
        mult[n] = (mult[n] || 0) + 1;
    }
    const tags = Object.entries(mult).map(([n, m]) =>
        `<span class="chordtag" style="background:${chordColor(n)}">${n}${m > 1 ? " &times;" + m : ""}</span>`).join("");

    const rowNums = [];
    rows.forEach((s, r) => { if (rowCase[r] === num) rowNums.push(r + 1); });
    const pct = (info.n / rows.length * 100).toFixed(1);
    const thumbs = rowNums.map(rn => {
        const n = String(rn).padStart(4, "0");
        return `<a class="th" href="solutions_unlabeled_${n}.svg" title="gallery solution ${rn} \u2014 click to open"><img loading="lazy" src="solutions_unlabeled_${n}.svg" alt="solution ${rn}"><div>${rn}</div></a>`;
    }).join("\n");

    blocks.push(`<div class="case">
  <div class="casehead">
    <div class="diagram">${caseDiagram(segList)}</div>
    <div class="meta">
      <div class="caseno">Case ${num}</div>
      <div class="casestats">${info.n} of ${rows.length} solutions (${pct}%)</div>
      <div class="casechords">${tags}</div>
      <div class="caseinfo">The board is crossed end-to-end by every full cut-line listed above; other internal joints stay short of the edges. The diagram draws the cut-lines of one representative solution of the case; mirror or rotated orientations of the same pattern occur in the other solutions shown below.</div>
    </div>
  </div>
  <div class="thumbgrid">
${thumbs}
  </div>
</div>`);
});

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Ostomachion &mdash; spanning-cut cases (${ordered.length} over ${rows.length} solutions)</title>
<style>
    body { background:#f5f2ea; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; margin:0; padding:16px; }
    h1 { font-weight:300; color:#444; margin:4px 0 4px 4px; }
    p.sub { color:#8a8070; margin:0 0 12px 4px; max-width:980px; }
    a { color:#BC8932; }
    .case { background:#fff; border:1px solid #d8d2c2; margin:0 0 18px; padding:12px; }
    .casehead { display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; }
    .diagram { border:1px solid #d8d2c2; background:#faf8f2; padding:6px; }
    .diagram svg { display:block; }
    .meta { flex:1 1 280px; min-width:0; }
    .caseno { font-size:20px; font-weight:300; color:#444; margin:0 0 4px; }
    .casestats { font-size:13px; color:#8a8070; margin:0 0 8px; }
    .casechords { margin:0 0 8px; }
    .chordtag { display:inline-block; padding:1px 7px; border-radius:3px; color:#fff; font-size:11px; margin:0 4px 3px 0; }
    .caseinfo { font-size:12px; color:#8a8070; max-width:520px; }
    .thumbgrid { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .th { background:#faf8f2; border:1px solid #d8d2c2; padding:3px; text-align:center; text-decoration:none; }
    .th img { display:block; width:132px; height:132px; }
    .th div { font-size:10px; color:#8a8070; padding-top:2px; }
</style>
</head>
<body>
<h1>Ostomachion &mdash; spanning-cut cases</h1>
<p class="sub">The ${rows.length} unlabeled tilings of the <a href="index.html">gallery</a> grouped by which maximal cut-lines cross the whole 12&times;12 board (full spanning cuts). ${ordered.length} distinct cases; every tiling has at least one. Each case shows its cut-lines as a diagram plus thumbnails of the gallery rows that realize it, most common first. <a href="flips.html">Flip table</a></p>
${blocks.join("\n")}
</body>
</html>
`;
fs.writeFileSync(path.join(outDir, "cases.html"), html);
console.log(`wrote cases.html (${ordered.length} cases, ${blocks.join("").length} bytes of blocks) to ${outDir}`);
