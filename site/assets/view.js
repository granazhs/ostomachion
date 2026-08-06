const CANVAS_W = 1280;
const CANVAS_H = 900;
const SCALE = 36;
const BOARD_X = 28;
const BOARD_Y = 36;
const EPS = 1e-9;
const GRID = 12;

const COLORS = ["#E53935", "#D81B60", "#8E24AA", "#5E35B1", "#3949AB",
                "#1E88E5", "#00897B", "#43A047", "#C0CA33", "#F4511E",
                "#FDD835", "#FB8C00", "#6D4C41", "#546E7A"];

const PIECE_V = [
    [[2, 8], [3, 6], [3, 12]],
    [[9, 6], [12, 4], [12, 6]],
    [[2, 8], [3, 12], [0, 12]],
    [[6, 0], [6, 6], [4, 4]],
    [[8, 8], [6, 12], [6, 6]],
    [[8, 8], [9, 6], [12, 12]],
    [[12, 6], [12, 12], [9, 6]],
    [[2, 2], [0, 12], [0, 0]],
    [[3, 6], [2, 8], [0, 12], [2, 2], [4, 4]],
    [[6, 0], [4, 4], [2, 2], [0, 0]],
    [[8, 8], [12, 12], [6, 12]],
    [[9, 6], [8, 8], [6, 6], [6, 0]],
    [[6, 6], [6, 12], [3, 12], [3, 6], [4, 4]],
    [[6, 0], [12, 0], [12, 4], [9, 6]]
];

var pieces;
var active;
var hover;
var solved_flag;
var canvas;
var ctx;
var drag_dx;
var drag_dy;

function area_centroid(poly) {
    var A = 0, cx = 0, cy = 0, n = poly.length;
    for (var i = 0; i < n; i++) {
        var x0 = poly[i][0], y0 = poly[i][1];
        var x1 = poly[(i + 1) % n][0], y1 = poly[(i + 1) % n][1];
        var cr = x0 * y1 - x1 * y0;
        A += cr;
        cx += (x0 + x1) * cr;
        cy += (y0 + y1) * cr;
    }
    A /= 2;
    return [cx / (6 * A), cy / (6 * A)];
}

function bbox(poly) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var i = 0; i < poly.length; i++) {
        if (poly[i][0] < minx) minx = poly[i][0];
        if (poly[i][0] > maxx) maxx = poly[i][0];
        if (poly[i][1] < miny) miny = poly[i][1];
        if (poly[i][1] > maxy) maxy = poly[i][1];
    }
    return [minx, miny, maxx, maxy];
}

function make_pieces() {
    var res = [];
    for (var i = 0; i < PIECE_V.length; i++) {
        var v = PIECE_V[i];
        var c = area_centroid(v);
        res.push({v: v, cx: c[0], cy: c[1], x: 0, y: 0, rot: 0, flip: 0, color: COLORS[i]});
    }
    return res;
}

function tray_layout(ps) {
    var tray_x = 13.2;
    var tray_y = 0.5;
    var width_budget = 21.4;
    var gap = 0.5;
    var order = [];
    for (var i = 0; i < ps.length; i++)
        order.push(i);
    order.sort(function(a, b) {
        var ha = bbox(ps[a].v)[3] - bbox(ps[a].v)[1];
        var hb = bbox(ps[b].v)[3] - bbox(ps[b].v)[1];
        return hb !== ha ? hb - ha : a - b;
    });
    var rows = [];
    for (var k = 0; k < order.length; k++) {
        var idx = order[k];
        var bb = bbox(ps[idx].v);
        var w = bb[2] - bb[0];
        var h = bb[3] - bb[1];
        var placed = false;
        for (var r = 0; r < rows.length; r++) {
            if (rows[r].w + w + gap <= width_budget) {
                rows[r].items.push(idx);
                rows[r].w += w + gap;
                if (h > rows[r].h)
                    rows[r].h = h;
                placed = true;
                break;
            }
        }
        if (!placed)
            rows.push({w: w + gap, h: h, items: [idx]});
    }
    var cy = tray_y;
    for (var r = 0; r < rows.length; r++) {
        var cx = tray_x;
        for (var m = 0; m < rows[r].items.length; m++) {
            var i2 = rows[r].items[m];
            var bb2 = bbox(ps[i2].v);
            ps[i2].x = cx - bb2[0];
            ps[i2].y = cy - bb2[1];
            cx += (bb2[2] - bb2[0]) + gap;
        }
        cy += rows[r].h + gap;
    }
}

function rotflip_off(p, ox, oy) {
    if (p.flip)
        ox = -ox;
    var r = p.rot % 360;
    if (r < 0)
        r += 360;
    if (r === 90)
        return [-oy, ox];
    if (r === 180)
        return [-ox, -oy];
    if (r === 270)
        return [oy, -ox];
    return [ox, oy];
}

function piece_vertices(p) {
    var o0 = rotflip_off(p, p.v[0][0] - p.cx, p.v[0][1] - p.cy);
    var w0x = p.cx + o0[0] + p.x;
    var w0y = p.cy + o0[1] + p.y;
    var res = [[w0x, w0y]];
    for (var i = 1; i < p.v.length; i++) {
        var o = rotflip_off(p, p.v[i][0] - p.v[0][0], p.v[i][1] - p.v[0][1]);
        res.push([w0x + o[0], w0y + o[1]]);
    }
    return res;
}

function snap(p) {
    p.rot = ((Math.round(p.rot / 90) * 90) % 360 + 360) % 360;
    var ws = piece_vertices(p);
    var w0 = ws[0];
    p.x += Math.round(w0[0]) - w0[0];
    p.y += Math.round(w0[1]) - w0[1];
    var ws2 = piece_vertices(p);
    var u0 = ws2[0];
    p.x += Math.round(u0[0]) - u0[0];
    p.y += Math.round(u0[1]) - u0[1];
}

function pip(pt, poly) {
    var x = pt[0], y = pt[1];
    var inside = false;
    var n = poly.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
        var xi = poly[i][0], yi = poly[i][1];
        var xj = poly[j][0], yj = poly[j][1];
        if ((yj - yi) * (x - xi) === (xj - xi) * (y - yi) &&
                x >= Math.min(xi, xj) && x <= Math.max(xi, xj) &&
                y >= Math.min(yi, yj) && y <= Math.max(yi, yj))
            return 0;
        if ((yi > y) !== (yj > y)) {
            var xint = (xj - xi) * (y - yi) / (yj - yi) + xi;
            if (x < xint)
                inside = !inside;
        }
    }
    return inside ? 1 : -1;
}

function seg_proper(p1, p2, p3, p4) {
    var o1 = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    var o2 = (p2[0] - p1[0]) * (p4[1] - p1[1]) - (p2[1] - p1[1]) * (p4[0] - p1[0]);
    var o3 = (p4[0] - p3[0]) * (p1[1] - p3[1]) - (p4[1] - p3[1]) * (p1[0] - p3[0]);
    var o4 = (p4[0] - p3[0]) * (p2[1] - p3[1]) - (p4[1] - p3[1]) * (p2[0] - p3[0]);
    return o1 * o2 < 0 && o3 * o4 < 0;
}

function overlap(a, b) {
    var va = piece_vertices(a), vb = piece_vertices(b);
    var na = va.length, nb = vb.length;
    for (var i = 0; i < na; i++)
        for (var j = 0; j < nb; j++)
            if (seg_proper(va[i], va[(i + 1) % na], vb[j], vb[(j + 1) % nb]))
                return true;
    for (var k = 0; k < na; k++)
        if (pip(va[k], vb) === 1)
            return true;
    for (var l = 0; l < nb; l++)
        if (pip(vb[l], va) === 1)
            return true;
    return false;
}

function in_square(p) {
    var ws = piece_vertices(p);
    for (var i = 0; i < ws.length; i++) {
        if (ws[i][0] < -EPS || ws[i][0] > GRID + EPS ||
                ws[i][1] < -EPS || ws[i][1] > GRID + EPS)
            return false;
    }
    return true;
}

function solve_ok(ps) {
    ps = ps || pieces;
    for (var i = 0; i < ps.length; i++)
        if (!in_square(ps[i]))
            return false;
    for (var j = 0; j < ps.length; j++)
        for (var k = j + 1; k < ps.length; k++)
            if (overlap(ps[j], ps[k]))
                return false;
    return true;
}

function in_place_count(ps) {
    ps = ps || pieces;
    var n = 0;
    for (var i = 0; i < ps.length; i++)
        if (in_square(ps[i]))
            n++;
    return n;
}

function to_grid(e) {
    var rect = canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    var py = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    return [(px - BOARD_X) / SCALE, (py - BOARD_Y) / SCALE];
}

function hit_test(g) {
    for (var i = pieces.length - 1; i >= 0; i--) {
        if (pip(g, piece_vertices(pieces[i])) !== -1)
            return pieces[i];
    }
    return null;
}

function move_to_top(p) {
    var i = pieces.indexOf(p);
    if (i >= 0) {
        pieces.splice(i, 1);
        pieces.push(p);
    }
}

function update_status() {
    if (typeof $ === "undefined")
        return;
    if (solved_flag)
        $("#status").text(i18n[cur_lang]["solved"]).addClass("solved");
    else
        $("#status").text(i18n[cur_lang]["status"](in_place_count())).removeClass("solved");
}

function rotate_active() {
    if (!active) {
        active = hover || pieces[pieces.length - 1];
        if (!active)
            return;
    }
    active.rot = (active.rot + 90) % 360;
    snap(active);
}

function flip_active() {
    if (!active) {
        active = hover || pieces[pieces.length - 1];
        if (!active)
            return;
    }
    active.flip = 1 - active.flip;
    snap(active);
}

function reset() {
    for (var i = 0; i < pieces.length; i++) {
        pieces[i].rot = 0;
        pieces[i].flip = 0;
    }
    tray_layout(pieces);
    active = null;
    hover = null;
    solved_flag = false;
    update_status();
}

function check_solved() {
    if (!solved_flag && solve_ok()) {
        solved_flag = true;
        update_status();
    }
}

function draw_board() {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.strokeRect(BOARD_X, BOARD_Y, GRID * SCALE, GRID * SCALE);
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    for (var i = 1; i < GRID; i++) {
        var v = BOARD_X + i * SCALE;
        ctx.beginPath();
        ctx.moveTo(v, BOARD_Y);
        ctx.lineTo(v, BOARD_Y + GRID * SCALE);
        ctx.stroke();
        var h = BOARD_Y + i * SCALE;
        ctx.beginPath();
        ctx.moveTo(BOARD_X, h);
        ctx.lineTo(BOARD_X + GRID * SCALE, h);
        ctx.stroke();
    }
}

function draw_piece(p) {
    var ws = piece_vertices(p);
    ctx.beginPath();
    ctx.moveTo(BOARD_X + ws[0][0] * SCALE, BOARD_Y + ws[0][1] * SCALE);
    for (var i = 1; i < ws.length; i++)
        ctx.lineTo(BOARD_X + ws[i][0] * SCALE, BOARD_Y + ws[i][1] * SCALE);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    if (solved_flag) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#BC8932";
    } else if (p === active) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#BC8932";
    } else if (p === hover) {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#999";
    } else {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#222";
    }
    ctx.stroke();
}

function draw() {
    ctx.fillStyle = "#f5f2ea";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    draw_board();
    for (var i = 0; i < pieces.length; i++)
        draw_piece(pieces[i]);
    if (solved_flag) {
        ctx.fillStyle = "rgba(245, 242, 234, 0.85)";
        ctx.fillRect(0, 0, CANVAS_W, 120);
        ctx.fillStyle = "#BC8932";
        ctx.font = "bold 44px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(i18n[cur_lang]["solved"], CANVAS_W / 2, 80);
        ctx.font = "24px 'Helvetica Neue', Helvetica, Arial, sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText(i18n[cur_lang]["reset"], CANVAS_W / 2, 112);
    }
}

function loop() {
    draw();
    requestAnimationFrame(loop);
}

function fit_embedded() {
    var sc = Math.min(window.innerWidth / (CANVAS_W + 260),
                      window.innerHeight / CANVAS_H, 1);
    $("#canvas").css("width", CANVAS_W * sc).css("height", CANVAS_H * sc);
    $("#controls").css("transform", "scale(" + sc + ")");
    $("#controls").css("transform-origin", "left top");
}

function boot() {
    canvas = document.getElementById("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext("2d");
    pieces = make_pieces();
    tray_layout(pieces);
    active = null;
    hover = null;
    solved_flag = false;
    i18n_load();
    $("#rotate-button").on("click", rotate_active);
    $("#flip-button").on("click", flip_active);
    $("#reset-button").on("click", reset);
    document.addEventListener("keydown", function(e) {
        var k = e.key;
        if (k === "r" || k === "R")
            rotate_active();
        else if (k === "f" || k === "F")
            flip_active();
    });
    canvas.addEventListener("pointerdown", function(e) {
        var g = to_grid(e);
        var p = hit_test(g);
        if (p) {
            active = p;
            drag_dx = g[0] - p.x;
            drag_dy = g[1] - p.y;
            move_to_top(p);
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch (err) {
            }
            e.preventDefault();
        }
    });
    canvas.addEventListener("pointermove", function(e) {
        var g = to_grid(e);
        if (active) {
            active.x = g[0] - drag_dx;
            active.y = g[1] - drag_dy;
            e.preventDefault();
        } else {
            hover = hit_test(g);
        }
    });
    function end_drag() {
        if (active) {
            snap(active);
            active = null;
            update_status();
            check_solved();
        }
    }
    canvas.addEventListener("pointerup", end_drag);
    canvas.addEventListener("pointercancel", end_drag);
    canvas.style.touchAction = "none";
    requestAnimationFrame(loop);
    if (is_embedded)
        fit_embedded();
}

if (typeof module !== "undefined" && module.exports)
    module.exports = {
        PIECE_V: PIECE_V,
        make_pieces: make_pieces,
        tray_layout: tray_layout,
        piece_vertices: piece_vertices,
        snap: snap,
        pip: pip,
        seg_proper: seg_proper,
        overlap: overlap,
        in_square: in_square,
        solve_ok: solve_ok,
        in_place_count: in_place_count,
        bbox: bbox,
        area_centroid: area_centroid,
        GRID: GRID
    };
else
    $(function() {
        boot();
    });
