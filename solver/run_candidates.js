"use strict";
// Run candidate dissection models through count_solutions.js in parallel with a
// live progress bar. Resumable: models whose log already contains a final
// "distinct unlabeled tilings" line are skipped (so a long run can be
// interrupted and continued).
//
// Usage:
//   node run_candidates.js [-j N] [--pattern SUBSTR] [--dir DIR] [--force]
//     -j N          run at most N solvers at once (default 14)
//     --pattern S   only models whose id contains S (repeatable, e.g. i01 or j05)
//     --dir DIR     output directory (default /tmp/opencode)
//     --force       re-run models even if already finished

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const CANDIDATES = require("./candidate_models.js");

const SOLVER_DIR = __dirname;
const DEFAULT_CONCURRENCY = 14;
const DONE_RE = /^distinct unlabeled tilings\b/m;

function parseArgs(argv) {
    const a = { jobs: DEFAULT_CONCURRENCY, dir: "/tmp/opencode", patterns: [], force: false };
    for (let i = 0; i < argv.length; i++) {
        const v = argv[i];
        if (v === "-j" || v === "--jobs") { a.jobs = parseInt(argv[++i], 10); }
        else if (v === "--pattern") { a.patterns.push(argv[++i]); }
        else if (v === "--dir") { a.dir = argv[++i]; }
        else if (v === "--force") { a.force = true; }
        else if (v === "-h" || v === "--help") { a.help = true; }
    }
    return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !Number.isFinite(args.jobs) || args.jobs < 1) {
    console.log("Usage: node run_candidates.js [-j N] [--pattern SUBSTR] [--dir DIR] [--force]");
    process.exit(args.help ? 0 : 1);
}

const allIds = Object.keys(CANDIDATES);
const ids = args.patterns.length
    ? allIds.filter(id => args.patterns.some(p => id.includes(p)))
    : allIds;
fs.mkdirSync(args.dir, { recursive: true });

const isDone = id => {
    const log = path.join(args.dir, id + ".log");
    if (!fs.existsSync(log)) return false;
    return DONE_RE.test(fs.readFileSync(log, "utf8"));
};
const isRunning = id => {
    try { process.kill(Number(fs.readFileSync(path.join(args.dir, id + ".pid"), "utf8")), 0); return true; }
    catch (e) { return false; }
};

const queue = args.force ? ids.slice() : ids.filter(id => !isDone(id) && !isRunning(id));
const skipped = ids.length - queue.length;

// ---------- progress display ----------
const out = process.stdout;
const isTTY = Boolean(out.isTTY);
const started = Date.now();
let doneCount = 0, failCount = 0;
const running = new Map();
let lastRender = 0;

const TERM_WIDTH = out.columns || 100;
function hms(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
}
function render(force) {
    if (!isTTY) return;
    const now = Date.now();
    if (!force && now - lastRender < 200) return;
    lastRender = now;
    const total = ids.length;
    const done = doneCount + skipped;
    const pct = total ? (done / total) * 100 : 100;
    const w = Math.max(10, TERM_WIDTH - 56);
    const filled = Math.round((pct / 100) * w);
    const elapsed = now - started;
    const rate = done ? elapsed / done : 0;
    const eta = rate ? rate * (total - done) : 0;
    const bar = "=".repeat(filled) + ">" + " ".repeat(Math.max(0, w - filled - 1));
    let line = `[${bar}] ${pct.toFixed(1).padStart(5)}%  ${done}/${total}  run ${running.size}  fail ${failCount}  ETA ${hms(eta)}`;
    if (running.size) line += `  |  ${[...running.keys()].join(" ")}`;
    out.write("\r\x1b[2K" + line.slice(0, TERM_WIDTH - 1));
}
setInterval(() => render(false), 200);
process.on("exit", () => { if (isTTY) out.write("\r\x1b[2K\x1b[?25h"); });

// ---------- workers ----------
function finish(id, code) {
    running.delete(id);
    const log = path.join(args.dir, id + ".log");
    const doneLine = fs.existsSync(log) && DONE_RE.test(fs.readFileSync(log, "utf8"));
    if (code !== 0 || !doneLine) {
        failCount++;
        const prefix = isTTY ? "\r\x1b[2K" : "";
        out.write(`${prefix}\x1b[31mFAIL\x1b[0m ${id} (exit ${code})${code !== 0 ? "" : " — no final count"}\n`);
    } else {
        doneCount++;
        const m = fs.readFileSync(log, "utf8").match(/^distinct unlabeled tilings.*?:\s*(\d+)/m);
        const prefix = isTTY ? "\r\x1b[2K" : "";
        out.write(`${prefix}\x1b[32mDONE\x1b[0m ${id}  unlabeled=${m ? m[1] : "?"}\n`);
    }
    render(true);
    pump();
}

function start(id) {
    const log = path.join(args.dir, id + ".log");
    const fd = fs.openSync(log, "w");
    const child = spawn("node", ["count_solutions.js", path.join(args.dir, "sol_" + id + ".json")], {
        cwd: SOLVER_DIR,
        env: { ...process.env, OSTOMACHION_CONFIG: id },
        stdio: ["ignore", fd, fd]
    });
    fs.writeFileSync(path.join(args.dir, id + ".pid"), String(child.pid));
    running.set(id, child);
    child.on("exit", code => { try { fs.closeSync(fd); } catch (e) {} finish(id, code); });
    child.on("error", () => finish(id, -1));
}

function pump() {
    while (running.size < args.jobs && queue.length) start(queue.shift());
    if (!running.size) {
        out.write("\r\x1b[2K\x1b[?25h");
        console.log(`\nfinished ${doneCount}, failed ${failCount}, skipped ${skipped}, in ${hms(Date.now() - started)}`);
        process.exit(failCount ? 1 : 0);
    }
}

// ---------- go ----------
console.log(`running ${queue.length} model${queue.length === 1 ? "" : "s"} (${skipped} already done) with ${args.jobs} workers → ${args.dir}`);
process.on("SIGINT", () => {
    if (isTTY) out.write("\r\x1b[2K\x1b[?25h");
    console.log(`\ninterrupted — ${doneCount + skipped} done, ${running.size} in flight, ${queue.length} queued. Re-run to continue; in-flight results stay valid.`);
    running.forEach(c => c.kill("SIGKILL"));
    process.exit(130);
});
pump();
