"use strict";

const PIECE_V = [
    [[1, 2], [0, 0], [0, 6]],
    [[3, 6], [0, 8], [0, 6]],
    [[1, 2], [0, 6], [3, 6]],
    [[6, 0], [0, 0], [2, 2]],
    [[10, 8], [12, 12], [12, 6]],
    [[4, 4], [3, 6], [0, 0]],
    [[9, 0], [9, 6], [6, 0]],
    [[8, 10], [6, 0], [6, 12]],
    [[9, 6], [8, 4], [6, 0], [8, 10], [10, 8]],
    [[12, 12], [10, 8], [8, 10], [6, 12]],
    [[2, 2], [6, 6], [6, 0]],
    [[3, 6], [4, 4], [6, 6], [6, 12]],
    [[12, 6], [12, 0], [9, 0], [9, 6], [10, 8]],
    [[6, 12], [0, 12], [0, 8], [3, 6]]
];

const PIECE_NAMES = [
    "A", "B", "C", "D", "E", "F", "G",
    "H", "I", "J", "K", "L", "M", "N"
];

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
    norm360,
    angDist
};
