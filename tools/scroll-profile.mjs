// Scroll-performance profiler for Discord PTB over CDP (needs --remote-debugging-port=9229).
// Records a trace + JS CPU profile while wheel-scrolling the open channel, then attributes
// JS self-time through Vencord's source map to plugin folders.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const VENCORD = new URL("../../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const { TraceMap, originalPositionFor } = require(VENCORD + "/node_modules/.pnpm/@jridgewell+trace-mapping@0.3.25/node_modules/@jridgewell/trace-mapping/dist/trace-mapping.umd.js");

const PORT = 9229;
const SCROLL_MS = Number(process.argv[2] ?? 3000);   // per direction
const WHEEL_HZ = 60;

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find(t => t.type === "page" && t.url.includes("discord.com/channels"));
if (!page) throw new Error("no Discord page target");
console.log("target:", page.title, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let seq = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method && listeners.has(m.method)) for (const l of listeners.get(m.method)) l(m.params);
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send("Runtime.enable");
await send("Debugger.enable");
const scripts = new Map();
on("Debugger.scriptParsed", p => scripts.set(p.scriptId, { url: p.url, sourceMapURL: p.sourceMapURL, hasSourceURL: p.hasSourceURL }));
await sleep(500);

const env = await evaluate(`(() => {
    const scroller = document.querySelector('[class*="messagesWrapper"] [class*="scroller"]') || document.querySelector('[class*="scrollerInner"]')?.parentElement;
    const r = scroller?.getBoundingClientRect();
    return {
        rect: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height } : null,
        dpr: window.devicePixelRatio,
        refresh: null,
        nodes: document.getElementsByTagName("*").length,
        rules: [...document.styleSheets].reduce((n, s) => { try { return n + s.cssRules.length; } catch { return n; } }, 0),
        sheets: document.styleSheets.length,
        channel: document.title,
        vencordPlugins: Object.values(Vencord.Settings.plugins).filter(p => p.enabled).length,
        reducedMotion: Vencord.Webpack.findStore("AccessibilityStore").useReducedMotion,
        turbo: !!Vencord.Settings.plugins.Turbo?.enabled
    };
})()`);
if (!env.rect) throw new Error("message scroller not found; open a text channel or DM first");
// measure the real refresh rate from rAF
env.refresh = await evaluate(`new Promise(r => { setTimeout(() => r(null), 5000); let n = 0, t0 = performance.now(); function f(t) { if (++n === 120) r(Math.round(120000 / (t - t0))); else requestAnimationFrame(f); } requestAnimationFrame(f); })`);
if (env.refresh == null) console.log("(rAF not running: window hidden or minimized)");
console.log("env:", JSON.stringify(env));

// ---------- record ----------
const events = [];
on("Tracing.dataCollected", p => { for (const e of p.value) events.push(e); });
const tracingDone = new Promise(r => { on("Tracing.tracingComplete", r); setTimeout(() => { console.log("(tracingComplete timeout, using what arrived)"); r(); }, 60000); });

const WITH_SELECTOR_STATS = process.argv.includes("--selectors");
await send("Profiler.enable");
await send("Profiler.setSamplingInterval", { interval: 250 });
await send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
        includedCategories: [
            "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame",
            ...(WITH_SELECTOR_STATS ? ["disabled-by-default-blink.debug"] : [])
        ]
    }
});
await send("Profiler.start");
console.log("recording...");

const { x, y } = env.rect;
const wheel = async (deltaY, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
        await sleep(1000 / WHEEL_HZ);
    }
};
await wheel(-120, SCROLL_MS);   // up: older messages, forces new rows to mount
await wheel(120, SCROLL_MS);    // back down
await sleep(300);

console.log("scroll done, stopping profiler...");
const { profile } = await send("Profiler.stop");
console.log("profiler stopped, ending trace...");
await send("Tracing.end");
await tracingDone;
console.log(`trace events: ${events.length}`);
ws.close();
writeFileSync("scroll-trace.json", JSON.stringify({ traceEvents: events }));
writeFileSync("scroll-profile.cpuprofile", JSON.stringify(profile));

// ---------- analyse trace ----------
const ms = us => (us / 1000).toFixed(1);
const byName = new Map();
let droppedFrames = 0, drawnFrames = 0;
const tasks = [];
const selectorStats = new Map();
let styleRecalcElements = 0, styleRecalcs = 0, layoutNodes = 0, layouts = 0;
for (const e of events) {
    if (e.ph !== "X" && e.ph !== "I" && e.ph !== "B") continue;
    if (e.name === "DroppedFrame") droppedFrames++;
    if (e.name === "DrawFrame") drawnFrames++;
    if (e.ph === "X" && e.dur) {
        byName.set(e.name, (byName.get(e.name) ?? 0) + e.dur);
        if (e.name === "RunTask") tasks.push(e.dur);
        if (e.name === "UpdateLayoutTree") { styleRecalcs++; styleRecalcElements += e.args?.elementCount ?? 0; }
        if (e.name === "Layout") { layouts++; layoutNodes += e.args?.beginData?.dirtyObjects ?? 0; }
    }
    if (e.name === "SelectorStats" && e.args?.selector_stats?.selector_timings) {
        for (const s of e.args.selector_stats.selector_timings) {
            const k = s.selector;
            const cur = selectorStats.get(k) ?? { elapsed: 0, attempts: 0, matches: 0 };
            cur.elapsed += s.elapsed; cur.attempts += s.match_attempts; cur.matches += s.match_count;
            selectorStats.set(k, cur);
        }
    }
}
const budget = 1000 / (env.refresh || 165);
tasks.sort((a, b) => b - a);
const totalTask = tasks.reduce((a, b) => a + b, 0);
console.log(`\n=== main thread during ${2 * SCROLL_MS} ms of scrolling (refresh ${env.refresh} Hz, budget ${budget.toFixed(1)} ms/frame) ===`);
console.log(`frames drawn ${drawnFrames}, dropped ${droppedFrames}`);
console.log(`tasks: ${tasks.length}, busy ${ms(totalTask)} ms (${(100 * totalTask / 1000 / (2 * SCROLL_MS)).toFixed(0)}%), over budget ${tasks.filter(t => t > budget * 1000).length}, >16ms ${tasks.filter(t => t > 16000).length}, >50ms ${tasks.filter(t => t > 50000).length}, worst ${ms(tasks[0] ?? 0)} ms`);
const interesting = ["UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "FunctionCall", "EventDispatch", "HitTest", "ParseHTML", "EvaluateScript", "TimerFire", "GCEvent", "MinorGC", "MajorGC", "v8.compile", "ScheduleStyleInvalidationTracking", "StyleRecalcInvalidationTracking"];
console.log("\n--- time by phase (ms, nested totals) ---");
for (const n of interesting) if (byName.has(n)) console.log(`${n.padEnd(36)} ${ms(byName.get(n)).padStart(8)}`);
console.log(`style recalcs ${styleRecalcs}, elements recalculated ${styleRecalcElements} | layouts ${layouts}, dirty nodes ${layoutNodes}`);

if (selectorStats.size) {
    console.log("\n--- slowest CSS selectors (ms, attempts, matches) ---");
    for (const [sel, s] of [...selectorStats.entries()].sort((a, b) => b[1].elapsed - a[1].elapsed).slice(0, 20))
        console.log(`${(s.elapsed / 1000).toFixed(2).padStart(7)}  ${String(s.attempts).padStart(8)}  ${String(s.matches).padStart(6)}  ${sel.slice(0, 110)}`);
} else console.log("\n(no SelectorStats events; category not active in this Chromium)");

// ---------- analyse CPU profile ----------
const vencordScriptIds = new Set([...scripts.entries()].filter(([, s]) => /VencordRenderer|renderer\.js/.test(s.url) || /renderer\.js\.map/.test(s.sourceMapURL ?? "")).map(([id]) => id));
const map = new TraceMap(JSON.parse(readFileSync(VENCORD + "/dist/renderer.js.map", "utf8")));
const nodeById = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
const totalSampled = [...self.values()].reduce((a, b) => a + b, 0);

const byBucket = new Map();
const byFn = new Map();
const add = (m, k, v) => m.set(k, (m.get(k) ?? 0) + v);
for (const [id, t] of self) {
    const n = nodeById.get(id); const cf = n.callFrame;
    let bucket;
    if (vencordScriptIds.has(cf.scriptId) || /VencordRenderer|renderer\.js/.test(cf.url)) {
        const pos = originalPositionFor(map, { line: cf.lineNumber + 1, column: cf.columnNumber });
        const src = pos.source ?? "?";
        const m1 = src.match(/src\/(userplugins|plugins)\/([^/]+)/);
        bucket = m1 ? `vencord plugin: ${m1[2]}` : `vencord core: ${src.replace(/^.*?src\//, "src/").split("/").slice(0, 2).join("/")}`;
        add(byFn, `${bucket} :: ${cf.functionName || "(anon)"} @ ${src.replace(/^.*?src\//, "")}:${pos.line}`, t);
    } else if (cf.functionName === "(garbage collector)" || cf.functionName === "(program)" || cf.functionName === "(idle)" || cf.functionName === "(root)") {
        bucket = cf.functionName;
    } else {
        bucket = "discord";
        add(byFn, `discord :: ${cf.functionName || "(anon)"} @ ${(cf.url || "").split("/").pop()}:${cf.lineNumber}:${cf.columnNumber}`, t);
    }
    add(byBucket, bucket, t);
}
console.log(`\n=== JS self time (${(totalSampled / 1000).toFixed(0)} ms sampled) ===`);
for (const [k, v] of [...byBucket.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
    console.log(`${(v / 1000).toFixed(1).padStart(8)} ms  ${(100 * v / totalSampled).toFixed(1).padStart(5)}%  ${k}`);
console.log("\n--- hottest functions ---");
for (const [k, v] of [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
    console.log(`${(v / 1000).toFixed(1).padStart(8)} ms  ${k.slice(0, 140)}`);
