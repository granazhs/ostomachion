"use strict";

const {
    simplifyPoly,
    PIECE_V,
    PIECE_NAMES,
    area,
    edges,
    edgeLen,
    edgeAngleDeg,
    interiorAngles,
    norm360,
    angDist
} = require("./pieces.js");

function to90(deg) {
    let t = norm360(deg);
    if (t > 180) t -= 180;
    if (t > 90) t = 180 - t;
    return t;
}

const rows = PIECE_V.map((p, i) => {
    const es = edges(p);
    const lens = es.map(edgeLen);
    const angs = es.map(edgeAngleDeg);
    const ints = interiorAngles(p);
    const dir90 = angs.map(to90);
    return {
        name: PIECE_NAMES[i],
        area: area(p),
        edges: angs,
        lens,
        dir90,
        interior: ints
    };
});

const allDir90 = new Set();
for (const r of rows) for (const d of r.dir90) allDir90.add(+d.toFixed(3));

function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
}

const dirSlopes = {};
for (const [i, p] of PIECE_V.entries()) {
    for (const [dx, dy] of edges(p)) {
        const d = +to90(edgeAngleDeg([dx, dy])).toFixed(3);
        if (dirSlopes[d] !== undefined) continue;
        if (dx === 0) dirSlopes[d] = "vertical";
        else if (dy === 0) dirSlopes[d] = "0";
        else {
            const g = gcd(dy, dx);
            dirSlopes[d] = `${Math.abs(dy / g)}/${Math.abs(dx / g)}`;
        }
    }
}

const allAngles = new Set();
for (const r of rows) for (const a of r.interior) allAngles.add(+a.toFixed(2));

let tw = "name".padEnd(4) + " area".padStart(6) + " | edge dir (deg, 0-90) | edge lens | interior angles";
console.log(tw);
for (const r of rows) {
    const dirs = r.dir90.map(d => +d.toFixed(1)).join(",");
    const lens = r.lens.map(l => +l.toFixed(3)).join(",");
    const ints = r.interior.map(a => +a.toFixed(1)).join(",");
    console.log(r.name.padEnd(4) + String(r.area).padStart(6) + " | " + dirs.padEnd(26) + " | " + lens.padEnd(26) + " | " + ints);
}

console.log("\nDistinct edge directions (normalized to 0-90) and slopes:");
for (const d of [...allDir90].sort((a, b) => a - b)) {
    console.log(`  ${d.toFixed(2).padStart(7)} deg -> slope ${dirSlopes[d]}`);
}

console.log("\nDistinct interior angles across all pieces:");
console.log("  " + [...allAngles].sort((a, b) => a - b).map(a => a.toFixed(1)).join(", "));

console.log("\nEdge-length multiset (all pieces):");
const allLens = [];
for (const r of rows) for (const l of r.lens) allLens.push(+l.toFixed(4));
console.log("  " + allLens.sort((a, b) => a - b).join(", "));

const totalArea = rows.reduce((s, r) => s + r.area, 0);
console.log(`\nTotal area: ${totalArea} (must be 144)`);

const byArea = {};
for (const r of rows) (byArea[r.area] = byArea[r.area] || []).push(r.name);
console.log("\nAreas by piece:");
for (const a of Object.keys(byArea).sort((x, y) => +x - +y)) {
    console.log(`  ${a.padStart(3)}: ${byArea[a].join(",")}`);
}

console.log("\nPiece congruence (same simplified shape, collinear vertices merged):");
const simple = PIECE_V.map(simplifyPoly);
const simpleLens = simple.map(sp => sp.length === PIECE_V[0].length ? null : null);
for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
        const a = edges(simple[i]).map(edgeLen).map(l => +l.toFixed(9)).sort((x, y) => x - y);
        const b = edges(simple[j]).map(edgeLen).map(l => +l.toFixed(9)).sort((x, y) => x - y);
        if (a.length === b.length && a.every((v, k) => Math.abs(v - b[k]) < 1e-6)) {
            console.log(`  ${rows[i].name} and ${rows[j].name} are congruent (simplified vertex counts ${simple[i].length} and ${simple[j].length})`);
        }
    }
}
