"use strict";

const CONFIGS = require("../site/assets/pieces.js");
const CANDIDATES = require("./candidate_models.js");
const CONFIG_MAP = Object.assign({}, CONFIGS, CANDIDATES);
const ACTIVE_CONFIG = process.env.OSTOMACHION_CONFIG || "classic";
const { names: PIECE_NAMES, pieces: PIECE_V } = CONFIG_MAP[ACTIVE_CONFIG];

function signedArea(poly) {
    let A = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const x0 = poly[i][0], y0 = poly[i][1];
        const x1 = poly[(i + 1) % n][0], y1 = poly[(i + 1) % n][1];
        A += x0 * y1 - x1 * y0;
    }
    return A / 2;
}

function area(poly) {
    return Math.abs(signedArea(poly));
}

function centroid(poly) {
    let A = 0, cx = 0, cy = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const x0 = poly[i][0], y0 = poly[i][1];
        const x1 = poly[(i + 1) % n][0], y1 = poly[(i + 1) % n][1];
        const cr = x0 * y1 - x1 * y0;
        A += cr;
        cx += (x0 + x1) * cr;
        cy += (y0 + y1) * cr;
    }
    A /= 2;
    return [cx / (6 * A), cy / (6 * A)];
}

function ccw(poly) {
    const pts = poly.map(p => p.slice());
    if (signedArea(pts) < 0) pts.reverse();
    return pts;
}

function edges(poly) {
    const n = poly.length;
    const out = [];
    for (let i = 0; i < n; i++) {
        const x0 = poly[i][0], y0 = poly[i][1];
        const x1 = poly[(i + 1) % n][0], y1 = poly[(i + 1) % n][1];
        out.push([x1 - x0, y1 - y0]);
    }
    return out;
}

function edgeLen(e) {
    return Math.hypot(e[0], e[1]);
}

function norm360(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    return d;
}

function angDist(a, b) {
    let d = norm360(b - a);
    if (d > 180) d = 360 - d;
    return d;
}

function edgeAngleDeg(e) {
    return norm360(Math.atan2(e[1], e[0]) * 180 / Math.PI);
}

function interiorAngles(poly) {
    const p = ccw(poly);
    const n = p.length;
    const out = [];
    for (let i = 0; i < n; i++) {
        const qx = p[(i + 1) % n][0] - p[i][0], qy = p[(i + 1) % n][1] - p[i][1];
        const px = p[(i + n - 1) % n][0] - p[i][0], py = p[(i + n - 1) % n][1] - p[i][1];
        let ang = Math.atan2(qx * py - qy * px, qx * px + qy * py) * 180 / Math.PI;
        if (ang < 0) ang += 360;
        out.push(ang);
    }
    return out;
}

function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
}

function canonShapeKey(poly) {
    const features = verts => {
        const n = verts.length;
        const lens = edges(verts).map(edgeLen);
        const turns = [];
        for (let i = 0; i < n; i++) {
            const v0 = verts[(i + n - 1) % n], v1 = verts[i], v2 = verts[(i + 1) % n];
            const ax = v1[0] - v0[0], ay = v1[1] - v0[1];
            const bx = v2[0] - v1[0], by = v2[1] - v1[1];
            turns.push(Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180 / Math.PI);
        }
        return lens.map((l, i) => [+l.toFixed(6), +turns[i].toFixed(6)]);
    };
    const p = ccw(simplifyPoly(poly));
    const mirror = verts => ccw(verts.map(([x, y]) => [x, -y]));
    const cands = [];
    for (const seq of [features(p), features(mirror(p))]) {
        for (let s = 0; s < seq.length; s++) {
            cands.push(JSON.stringify([...seq.slice(s), ...seq.slice(0, s)]));
        }
    }
    cands.sort();
    return cands[0];
}

function congruentPairs() {
    const byKey = new Map();
    PIECE_V.forEach((poly, i) => {
        const k = canonShapeKey(poly);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(i);
    });
    const pairs = [];
    for (const idx of byKey.values()) {
        if (idx.length < 2) continue;
        for (let i = 0; i < idx.length; i++) {
            for (let j = i + 1; j < idx.length; j++) pairs.push([idx[i], idx[j]]);
        }
    }
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return pairs;
}

function simplifyPoly(poly) {
    const p = poly.map(v => v.slice());
    let changed = true;
    while (changed && p.length > 3) {
        changed = false;
        for (let i = 0; i < p.length; i++) {
            const prev = p[(i + p.length - 1) % p.length];
            const cur = p[i];
            const next = p[(i + 1) % p.length];
            if ((cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0]) === 0) {
                p.splice(i, 1);
                changed = true;
                break;
            }
        }
    }
    return p;
}

module.exports = {
    CONFIGS,
    CONFIG_MAP,
    CANDIDATES,
    ACTIVE_CONFIG,
    PIECE_V,
    PIECE_NAMES,
    signedArea,
    area,
    centroid,
    ccw,
    edges,
    edgeLen,
    edgeAngleDeg,
    interiorAngles,
    simplifyPoly,
    canonShapeKey,
    congruentPairs,
    norm360,
    angDist
};
