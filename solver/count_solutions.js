"use strict";

const fs = require("fs");
const path = require("path");
const { PIECE_V, PIECE_NAMES, ccw, simplifyPoly } = require("./pieces.js");

const GRID = 12;
const H = 1000000000n;
const NB = 64;

const PAIRS = [[3, 4], [9, 10]];

function bgcd(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b) { const t = a % b; a = b; b = t; }
    return a;
}

function rot90(v) { return [-v[1], v[0]]; }

function orientPoly(verts, rot, flip) {
    let p = verts.map(v => v.slice());
    for (let r = 0; r < rot; r++) p = p.map(rot90);
    if (flip) p = p.map(v => [-v[0], v[1]]);
    return p;
}

function bbox(poly) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of poly) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
    }
    return [minx, miny, maxx, maxy];
}

function genPlacements(verts) {
    const res = [];
    const seen = new Set();
    for (let rot = 0; rot < 4; rot++) {
        for (const flip of [false, true]) {
            const p = orientPoly(verts, rot, flip);
            const [minx, miny, maxx, maxy] = bbox(p);
            for (let tx = -minx; tx <= GRID - maxx; tx++) {
                for (let ty = -miny; ty <= GRID - maxy; ty++) {
                    const poly = p.map(([x, y]) => [x + tx, y + ty]);
                    const key = JSON.stringify(poly);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    res.push(poly);
                }
            }
        }
    }
    return res;
}

function lineOfEdge(x0, y0, x1, y1) {
    let a = BigInt(y1 - y0);
    let b = -BigInt(x1 - x0);
    let c = a * BigInt(x0) + b * BigInt(y0);
    let g = bgcd(bgcd(a, b), c);
    if (g !== 0n) { a /= g; b /= g; c /= g; }
    if (a < 0n || (a === 0n && b < 0n)) { a = -a; b = -b; c = -c; }
    return [a, b, c];
}

function collectLines(allPlacements) {
    const map = new Map();
    for (const plist of allPlacements) {
        for (const poly of plist) {
            const n = poly.length;
            for (let i = 0; i < n; i++) {
                const [x0, y0] = poly[i];
                const [x1, y1] = poly[(i + 1) % n];
                if (x0 === x1 && y0 === y1) continue;
                const ln = lineOfEdge(x0, y0, x1, y1);
                map.set(ln.join(","), ln);
            }
        }
    }
    return [...map.values()];
}

function insideScaled(px, py, poly) {
    let inside = false;
    const n = poly.length;
    let xj = poly[n - 1][0], yj = poly[n - 1][1];
    for (let i = 0; i < n; i++) {
        const xi = poly[i][0], yi = poly[i][1];
        if ((yi > py) !== (yj > py)) {
            const dy = yi - yj;
            const lhs = (py - yj) * (xi - xj);
            const rhs = (px - xj) * dy;
            const toRight = dy > 0n ? lhs > rhs : lhs < rhs;
            if (toRight) inside = !inside;
        }
        xj = xi; yj = yi;
    }
    return inside;
}

function buildArrangement(lines) {
    const L = lines.length;
    let M = 1n;
    for (let i = 0; i < L; i++) {
        const a1 = lines[i][0], b1 = lines[i][1];
        for (let j = i + 1; j < L; j++) {
            const a2 = lines[j][0], b2 = lines[j][1];
            let D = a1 * b2 - a2 * b1;
            if (D === 0n) continue;
            if (D < 0n) D = -D;
            M = M / bgcd(M, D) * D;
        }
    }
    const S = 2n * M * 60n * H;
    const B = BigInt(GRID) * S;
    const scaled = lines.map(([a, b, c]) => [a, b, c * S]);

    const crosses = Array.from({ length: L }, () => new Map());
    for (let i = 0; i < L; i++) {
        const a1 = scaled[i][0], b1 = scaled[i][1], c1 = scaled[i][2];
        for (let j = i + 1; j < L; j++) {
            const a2 = scaled[j][0], b2 = scaled[j][1], c2 = scaled[j][2];
            const D = a1 * b2 - a2 * b1;
            if (D === 0n) continue;
            const x = (c1 * b2 - c2 * b1) / D;
            const y = (a1 * c2 - a2 * c1) / D;
            if (x < 0n || x > B || y < 0n || y > B) continue;
            const key = x + "," + y;
            crosses[i].set(key, [x, y]);
            crosses[j].set(key, [x, y]);
        }
    }

    const pointLists = [];
    const allPoints = new Map();
    for (let i = 0; i < L; i++) {
        const a = scaled[i][0], b = scaled[i][1], c = scaled[i][2];
        const pts = new Map();
        const cand = [];
        if (a !== 0n) {
            cand.push([c / a, 0n]);
            cand.push([(c - b * B) / a, B]);
        }
        if (b !== 0n) {
            cand.push([0n, c / b]);
            cand.push([B, (c - a * B) / b]);
        }
        for (const [x, y] of cand) {
            if (x < 0n || x > B || y < 0n || y > B) continue;
            pts.set(x + "," + y, [x, y]);
        }
        for (const p of crosses[i].values()) pts.set(p[0] + "," + p[1], p);
        const arr = [...pts.values()].sort((p, q) => {
            const k1 = b * p[0] - a * p[1];
            const k2 = b * q[0] - a * q[1];
            return k1 < k2 ? -1 : k1 > k2 ? 1 : 0;
        });
        pointLists.push(arr);
        for (const p of arr) allPoints.set(p[0] + "," + p[1], p);
    }

    const vertexOut = new Map();
    const lineOf = [];
    const angleOf = [];
    const heStart = [];
    const heEnd = [];
    for (let i = 0; i < L; i++) {
        const a = scaled[i][0], b = scaled[i][1];
        const dx = b, dy = -a;
        const pts = pointLists[i];
        for (let k = 0; k + 1 < pts.length; k++) {
            const P = pts[k], Q = pts[k + 1];
            const s = ((Q[0] - P[0]) * BigInt(dx) + (Q[1] - P[1]) * BigInt(dy)) > 0n ? 1 : -1;
            const ang = Math.atan2(s * Number(dy), s * Number(dx));
            const angRev = Math.atan2(-s * Number(dy), -s * Number(dx));
            const kP = P[0] + "," + P[1], kQ = Q[0] + "," + Q[1];
            const h1 = heEnd.length, h2 = heEnd.length + 1;
            lineOf[h1] = i; angleOf[h1] = ang; heStart[h1] = kP; heEnd[h1] = Q;
            lineOf[h2] = i; angleOf[h2] = angRev; heStart[h2] = kQ; heEnd[h2] = P;
            let o1 = vertexOut.get(kP);
            if (!o1) { o1 = []; vertexOut.set(kP, o1); }
            o1.push([h1, ang]);
            let o2 = vertexOut.get(kQ);
            if (!o2) { o2 = []; vertexOut.set(kQ, o2); }
            o2.push([h2, angRev]);
        }
    }
    const HE = heEnd.length;
    const next = new Int32Array(HE).fill(-1);
    const TWO_PI = 2 * Math.PI;
    for (let h = 0; h < HE; h++) {
        const end = heEnd[h];
        const outs = vertexOut.get(end[0] + "," + end[1]);
        const theta = angleOf[h] + Math.PI;
        let best = -1;
        let bestD = Infinity;
        for (const [h2, phi] of outs) {
            if (lineOf[h2] === lineOf[h]) continue;
            let d = theta - phi;
            d = ((d % TWO_PI) + TWO_PI) % TWO_PI;
            if (d < bestD) { bestD = d; best = h2; }
        }
        next[h] = best;
    }

    const color = new Uint8Array(HE);
    const faceSamples = [];
    let segCount = HE / 2;
    let totalArea2 = 0n;
    for (let h0 = 0; h0 < HE; h0++) {
        if (color[h0] !== 0) continue;
        const stack = [];
        let cur = h0;
        while (cur >= 0 && color[cur] === 0) {
            color[cur] = 1;
            stack.push(cur);
            cur = next[cur];
        }
        let cyc = [];
        if (cur >= 0 && color[cur] === 1) {
            const pos = stack.indexOf(cur);
            cyc = stack.slice(pos);
        }
        for (const h of stack) color[h] = 2;
        if (cyc.length === 0) continue;
        let sx = 0n, sy = 0n;
        const n = cyc.length;
        for (let t = 0; t < n; t++) {
            const [x, y] = heEnd[cyc[t]];
            sx += x;
            sy += y;
            const [x2, y2] = heEnd[cyc[(t + 1) % n]];
            totalArea2 += x * y2 - x2 * y;
        }
        faceSamples.push([sx / BigInt(n), sy / BigInt(n)]);
    }

    const V = allPoints.size;
    const sideX0 = [], sideXB = [], sideY0 = [], sideYB = [];
    for (const p of allPoints.values()) {
        if (p[0] === 0n) sideX0.push(p[1]);
        if (p[0] === B) sideXB.push(p[1]);
        if (p[1] === 0n) sideY0.push(p[0]);
        if (p[1] === B) sideYB.push(p[0]);
    }
    const gaps = arr => {
        arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        let g = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) g++;
        return g;
    };
    const gX0 = gaps(sideX0), gXB = gaps(sideXB), gY0 = gaps(sideY0), gYB = gaps(sideYB);
    const gapSum = gX0 + gXB + gY0 + gYB;
    const lineSet = new Set(lines.map(l => l.join(",")));
    const boundaryDup =
        (lineSet.has("0,1,0") ? gY0 : 0) +
        (lineSet.has("0,1,12") ? gYB : 0) +
        (lineSet.has("1,0,0") ? gX0 : 0) +
        (lineSet.has("1,0,12") ? gXB : 0);
    const E = segCount + gapSum - boundaryDup;
    const F = E - V + 1;
    const totalArea = totalArea2 / 2n;
    return {
        S, B, faces: faceSamples, F, eulerF: F, eulerV: V, eulerE: E, segCount, gapSum, boundaryDup,
        faceCount: faceSamples.length,
        totalArea, boardArea: B * B
    };
}

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

function canonicalKey(tiling) {
    let best = null;
    for (const t of DIHEDRAL) {
        const labeled = [];
        const polys = [];
        for (const { vertices } of tiling) {
            const mapped = vertices.map(([x, y]) => t(x, y));
            const cp = canonPoly(mapped);
            labeled.push(cp);
            polys.push(cp);
        }
        const keyLabeled = JSON.stringify(labeled);
        const keyUnlabeled = JSON.stringify(polys.sort());
        const combined = keyLabeled + "\u0001" + keyUnlabeled;
        if (best === null || combined < best) best = combined;
    }
    return best;
}

function main() {
    const allPlacements = PIECE_V.map(genPlacements);
    console.log("placements per piece:", allPlacements.map(p => p.length).join(","));

    const lines = collectLines(allPlacements);
    console.log("distinct lines:", lines.length);

    const t0 = Date.now();
    const arr = buildArrangement(lines);
    console.log(`arrangement: V=${arr.eulerV} E=${arr.eulerE} (segCount=${arr.segCount} gapSum=${arr.gapSum} boundaryDup=${arr.boundaryDup}) eulerF=${arr.eulerF} faceWalk=${arr.faceCount} areaCheck=${arr.totalArea === arr.boardArea}`);
    if (arr.eulerF !== arr.faceCount) {
        console.error("FATAL: euler face count != face-walk face count");
        process.exit(1);
    }
    if (arr.totalArea !== arr.boardArea) {
        console.error("FATAL: face area sum != board area");
        process.exit(1);
    }
    const F = arr.faces.length;
    const S = arr.S;
    const B = arr.B;
    const faceSamples = arr.faces;
    const allFacesMask = (1n << BigInt(F)) - 1n;
    const W = (F >> 5) + 1;

    const buckets = Array.from({ length: NB * NB }, () => []);
    for (let f = 0; f < F; f++) {
        const [sx, sy] = faceSamples[f];
        let bx = Number((sx * BigInt(NB)) / B);
        let by = Number((sy * BigInt(NB)) / B);
        if (bx >= NB) bx = NB - 1;
        if (by >= NB) by = NB - 1;
        buckets[by * NB + bx].push(f);
    }

    function placementMask(polyScaled) {
        const [minx, miny, maxx, maxy] = bbox(polyScaled);
        let bx0 = Number((minx * BigInt(NB)) / B); if (bx0 < 0) bx0 = 0; if (bx0 >= NB) bx0 = NB - 1;
        let bx1 = Number((maxx * BigInt(NB)) / B); if (bx1 < 0) bx1 = 0; if (bx1 >= NB) bx1 = NB - 1;
        let by0 = Number((miny * BigInt(NB)) / B); if (by0 < 0) by0 = 0; if (by0 >= NB) by0 = NB - 1;
        let by1 = Number((maxy * BigInt(NB)) / B); if (by1 < 0) by1 = 0; if (by1 >= NB) by1 = NB - 1;
        let mask = 0n;
        for (let by = by0; by <= by1; by++) {
            for (let bx = bx0; bx <= bx1; bx++) {
                for (const f of buckets[by * NB + bx]) {
                    if (insideScaled(faceSamples[f][0], faceSamples[f][1], polyScaled)) mask |= 1n << BigInt(f);
                }
            }
        }
        return mask;
    }

    const placements = allPlacements.map(plist => plist.map(poly => {
        const polyScaled = poly.map(([x, y]) => [BigInt(x) * S, BigInt(y) * S]);
        const mask = placementMask(polyScaled);
        const wlist = [];
        let mm = mask;
        let base = 0;
        while (mm) {
            let low = Number(mm & 0xFFFFFFFFn);
            if (low) { wlist.push(base >>> 5, low >>> 0); }
            mm >>= 32n;
            base += 32;
        }
        return { mask, poly, canon: canonPoly(poly), wlist: new Uint32Array(wlist) };
    }));
    const tMask = Date.now();
    console.log(`masks computed in ${tMask - t0}ms`);

    const dedup = placements.map(plist => {
        const seen = new Set();
        const out = [];
        for (const p of plist) {
            const k = p.mask.toString();
            if (!seen.has(k)) { seen.add(k); out.push(p); }
        }
        return out;
    });
    console.log("distinct placements per piece:", dedup.map(p => p.length).join(","));

    const N = PIECE_V.length;

    const coverLists = Array.from({ length: F }, () => []);
    let coverTotal = 0;
    for (let i = 0; i < N; i++) {
        const plist = dedup[i];
        for (let pi = 0; pi < plist.length; pi++) {
            const packed = (i << 10) | pi;
            let mm = plist[pi].mask;
            let base = 0;
            while (mm) {
                let low = Number(mm & 0xFFFFFFFFn);
                while (low) {
                    const b = low & -low;
                    low ^= b;
                    coverLists[base + (31 - Math.clz32(b))].push(packed);
                    coverTotal++;
                }
                mm >>= 32n;
                base += 32;
            }
        }
    }
    const coverOffset = new Int32Array(F + 1);
    const coverEntries = new Uint16Array(coverTotal);
    {
        let acc = 0;
        for (let f = 0; f < F; f++) {
            coverOffset[f] = acc;
            for (const e of coverLists[f]) coverEntries[acc++] = e;
        }
        coverOffset[F] = acc;
    }
    const coverSize = coverOffset[F];
    console.log(`cover index: ${coverSize} entries (${(coverSize * 2 / 1048576).toFixed(1)} MB)`);
    {
        const lens = [];
        for (let f = 0; f < F; f++) lens.push(coverOffset[f + 1] - coverOffset[f]);
        lens.sort((a, b) => a - b);
        const pct = k => lens[Math.floor((F - 1) * k)].toFixed(0);
        const minL = lens[0], maxL = lens[F - 1];
        const meanL = (coverSize / F).toFixed(0);
        console.log(`coverLen: min=${minL} p50=${pct(0.5)} p90=${pct(0.9)} p99=${pct(0.99)} max=${maxL} mean=${meanL}`);
    }

    const atomOf = new Int32Array(F);
    let F2 = 0;
    {
        const H = new Uint32Array(F);
        for (let f = 0; f < F; f++) {
            let h = 0x811c9dc5;
            for (let k = coverOffset[f]; k < coverOffset[f + 1]; k++) {
                h = Math.imul(h ^ coverEntries[k], 16777619);
            }
            H[f] = h >>> 0;
        }
        const sorted = new Uint32Array(F);
        for (let f = 0; f < F; f++) sorted[f] = f;
        sorted.sort((a, b) => H[a] - H[b] || a - b);
        const listEq = (a, b) => {
            const la = coverOffset[a + 1] - coverOffset[a];
            const lb = coverOffset[b + 1] - coverOffset[b];
            if (la !== lb) return false;
            for (let k = 0; k < la; k++) {
                if (coverEntries[coverOffset[a] + k] !== coverEntries[coverOffset[b] + k]) return false;
            }
            return true;
        };
        let i = 0;
        while (i < F) {
            let j = i;
            const h = H[sorted[i]];
            while (j < F && H[sorted[j]] === h) j++;
            const groups = [];
            for (let t = i; t < j; t++) {
                const f = sorted[t];
                let found = false;
                for (const g of groups) {
                    if (listEq(g[0], f)) { g.push(f); found = true; break; }
                }
                if (!found) groups.push([f]);
            }
            for (const g of groups) {
                for (const f of g) atomOf[f] = F2;
                F2++;
            }
            i = j;
        }
    }
    console.log(`faces ${F} -> atoms ${F2} (${(F / F2).toFixed(1)}x merge)`);

    const atomSample = new Array(F2);
    for (let f = 0; f < F; f++) if (atomSample[atomOf[f]] === undefined) atomSample[atomOf[f]] = faceSamples[f];
    const atomOrder = [];
    for (let a = 0; a < F2; a++) atomOrder.push(a);
    atomOrder.sort((a, b) => {
        const sa = atomSample[a], sb = atomSample[b];
        return sa[1] < sb[1] ? -1 : sa[1] > sb[1] ? 1 : (sa[0] < sb[0] ? -1 : sa[0] > sb[0] ? 1 : a - b);
    });
    const atomNewIndex = new Int32Array(F2);
    for (let k = 0; k < F2; k++) atomNewIndex[atomOrder[k]] = k;

    for (const plist of dedup) for (const p of plist) {
        let mask2 = 0n;
        let mm = p.mask;
        let base = 0;
        while (mm) {
            let low = Number(mm & 0xFFFFFFFFn);
            while (low) {
                const b = low & -low;
                low ^= b;
                mask2 |= 1n << BigInt(atomNewIndex[atomOf[base + (31 - Math.clz32(b))]]);
            }
            mm >>= 32n;
            base += 32;
        }
        p.mask = mask2;
        const wl = [];
        let m2 = mask2;
        let b2 = 0;
        while (m2) {
            let low = Number(m2 & 0xFFFFFFFFn);
            if (low) wl.push(b2 >>> 5, low >>> 0);
            m2 >>= 32n;
            b2 += 32;
        }
        p.wlist = new Uint32Array(wl);
    }

    const coverLists2 = Array.from({ length: F2 }, () => []);
    let coverTotal2 = 0;
    for (let i = 0; i < N; i++) {
        const plist = dedup[i];
        for (let pi = 0; pi < plist.length; pi++) {
            const packed = (i << 10) | pi;
            let mm = plist[pi].mask;
            let base = 0;
            while (mm) {
                let low = Number(mm & 0xFFFFFFFFn);
                while (low) {
                    const b = low & -low;
                    low ^= b;
                    coverLists2[base + (31 - Math.clz32(b))].push(packed);
                    coverTotal2++;
                }
                mm >>= 32n;
                base += 32;
            }
        }
    }
    const coverOffset2 = new Int32Array(F2 + 1);
    const coverEntries2 = new Uint16Array(coverTotal2);
    {
        let acc = 0;
        for (let f = 0; f < F2; f++) {
            coverOffset2[f] = acc;
            for (const e of coverLists2[f]) coverEntries2[acc++] = e;
        }
        coverOffset2[F2] = acc;
    }
    console.log(`cover index (atoms): ${coverTotal2} entries`);

    const orPerPiece = dedup.map(pl => pl.reduce((m, p) => m | p.mask, 0n));
    const allFacesMask2 = orPerPiece.reduce((m, x) => m | x, 0n);

    let or = 0n;
    let disjoint = true;
    for (const poly of PIECE_V) {
        const polyScaled = poly.map(([x, y]) => [BigInt(x) * S, BigInt(y) * S]);
        const mask = placementMask(polyScaled);
        if (or & mask) disjoint = false;
        or |= mask;
    }
    console.log("canonical construction: OR==allFaces:", or === allFacesMask, "disjoint:", disjoint);
    if (or !== allFacesMask || !disjoint) {
        console.error("FATAL: canonical construction does not tile");
        process.exit(1);
    }

    const pot = new Array(1 << N);
    pot[0] = 0n;
    for (let s = 1; s < (1 << N); s++) {
        const b = s & -s;
        const i = Math.log2(b) | 0;
        pot[s] = pot[s ^ b] | orPerPiece[i];
    }

    const W2 = (F2 >> 5) + 1;

    let rawSym = 0;
    let nodes = 0;
    const chosen = new Array(N);
    const solutions = [];
    const start = Date.now();
    let lastReport = start;

    const remWords = new Uint32Array(W2);
    for (let w = 0; w < W2; w++) {
        const bitsInWord = Math.min(32, F2 - (w << 5));
        remWords[w] = bitsInWord === 32 ? 0xFFFFFFFF : ((1 << bitsInWord) - 1);
    }

    function firstFace() {
        for (let w = 0; w < W2; w++) {
            const v = remWords[w];
            if (v) return (w << 5) + (31 - Math.clz32(v));
        }
        return -1;
    }

    function symOK(i, pl, placedMask) {
        for (const [lo, hi] of PAIRS) {
            if (i === lo && (placedMask & (1 << hi))) {
                if (pl.canon > chosen[hi].canon) return false;
            }
            if (i === hi && (placedMask & (1 << lo))) {
                if (pl.canon < chosen[lo].canon) return false;
            }
        }
        return true;
    }

    function report() {
        const now = Date.now();
        if (now - lastReport > 10000) {
            console.log(`  ... nodes=${nodes} solutions=${rawSym} ${now - start}ms (${(nodes / (now - start) * 1000).toFixed(0)} nodes/s)`);
            lastReport = now;
        }
    }

    const watchdog = setInterval(report, 5000);

    function disjointOK(pl) {
        const wl = pl.wlist;
        for (let k = 0; k < wl.length; k += 2) {
            if (((remWords[wl[k]] & wl[k + 1]) >>> 0) !== wl[k + 1]) return false;
        }
        return true;
    }

    function dfs(remPieces, remFaces, placedMask) {
        nodes++;
        if ((nodes & 0xFFF) === 0) report();
        if (remFaces === 0n) {
            rawSym++;
            const tiling = [];
            for (let i = 0; i < N; i++) tiling.push({ piece: PIECE_NAMES[i], vertices: chosen[i].poly });
            solutions.push(tiling);
            if (rawSym % 5000 === 0) console.log(`  ... ${rawSym} solutions, nodes=${nodes}, ${Date.now() - start}ms`);
            return;
        }
        if (remPieces === 0) return;
        if ((pot[remPieces] & remFaces) !== remFaces) return;
        const f = firstFace();
        const a = coverOffset2[f], b = coverOffset2[f + 1];
        for (let k = a; k < b; k++) {
            const packed = coverEntries2[k];
            const i = packed >> 10;
            if (!(remPieces & (1 << i))) continue;
            const pl = dedup[i][packed & 1023];
            if (!disjointOK(pl)) continue;
            if (!symOK(i, pl, placedMask)) continue;
            chosen[i] = pl;
            const wl = pl.wlist;
            for (let k2 = 0; k2 < wl.length; k2 += 2) remWords[wl[k2]] &= ~wl[k2 + 1];
            dfs(remPieces ^ (1 << i), remFaces & ~pl.mask, placedMask | (1 << i));
            for (let k2 = 0; k2 < wl.length; k2 += 2) remWords[wl[k2]] |= wl[k2 + 1];
        }
    }

    dfs((1 << N) - 1, allFacesMask2, 0);
    clearInterval(watchdog);
    const searchMs = Date.now() - start;
    console.log(`search: ${rawSym} symmetry-reduced tilings, nodes=${nodes}, time=${searchMs}ms`);

    const keys = new Set();
    for (const sol of solutions) keys.add(canonicalKey(sol));
    console.log(`distinct tilings (dihedral, labeled+unlabeled merged): ${keys.size}`);

    const rawKeys = new Set();
    const keyPairs = new Set();
    const unlabeledKeys = new Set();
    for (const sol of solutions) {
        for (let m = 0; m < 4; m++) {
            const sd = m & 1, sj = (m >> 1) & 1;
            const nameAt = i => {
                if (i === 3) return sd ? PIECE_NAMES[4] : PIECE_NAMES[3];
                if (i === 4) return sd ? PIECE_NAMES[3] : PIECE_NAMES[4];
                if (i === 9) return sj ? PIECE_NAMES[10] : PIECE_NAMES[9];
                if (i === 10) return sj ? PIECE_NAMES[9] : PIECE_NAMES[10];
                return PIECE_NAMES[i];
            };
            let rawKey = "";
            let bestLabeled = null;
            for (const t of DIHEDRAL) {
                const labelMap = {};
                for (let i = 0; i < N; i++) {
                    const cp = canonPoly(sol[i].vertices.map(([x, y]) => t(x, y)));
                    labelMap[nameAt(i)] = cp;
                    if (t === DIHEDRAL[0]) rawKey += nameAt(i) + ":" + cp + "|";
                }
                let key = "";
                for (const nm of PIECE_NAMES) key += nm + ":" + labelMap[nm] + "|";
                if (bestLabeled === null || key < bestLabeled) bestLabeled = key;
            }
            rawKeys.add(rawKey);
            keyPairs.add(bestLabeled);
        }
        let bestUnlabeled = null;
        for (const t of DIHEDRAL) {
            const polys = sol.map(s => canonPoly(s.vertices.map(([x, y]) => t(x, y)))).sort();
            const key = JSON.stringify(polys);
            if (bestUnlabeled === null || key < bestUnlabeled) bestUnlabeled = key;
        }
        unlabeledKeys.add(bestUnlabeled);
    }
    const rawCount = rawKeys.size;
    console.log(`raw (labeled, all syms counted) = ${rawCount}`);
    console.log(`distinct labeled tilings (dihedral, piece labels kept): ${keyPairs.size}`);
    console.log(`distinct unlabeled tilings (dihedral, congruent pieces merged): ${unlabeledKeys.size}`);

    console.log(`ratios: raw/labeled=${(rawCount / keyPairs.size).toFixed(4)} labeled/unlabeled=${(keyPairs.size / unlabeledKeys.size).toFixed(4)} total ${Date.now() - t0}ms`);

    const out = {
        grid: GRID,
        pieces: PIECE_NAMES,
        rawCount,
        labeledDistinct: keyPairs.size,
        unlabeledDistinct: unlabeledKeys.size,
        solutions: []
    };
    const canonByKey = new Map();
    for (const sol of solutions) {
        const key = canonicalKey(sol);
        if (!canonByKey.has(key)) canonByKey.set(key, sol);
    }
    out.solutions = [...canonByKey.values()].map(tiling =>
        tiling.map(({ piece, vertices }) => ({ piece, vertices }))
    );
    const outfile = process.argv[2] || path.join(__dirname, "solutions.json");
    fs.writeFileSync(outfile, JSON.stringify(out));
    console.log(`saved ${out.solutions.length} representative tilings to ${outfile}`);
}

main();
