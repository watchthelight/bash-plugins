// Who calls the hot native getters? Walk parents in the CPU profile.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const VENCORD = new URL("../../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const { TraceMap, originalPositionFor } = require(VENCORD + "/node_modules/.pnpm/@jridgewell+trace-mapping@0.3.25/node_modules/@jridgewell/trace-mapping/dist/trace-mapping.umd.js");
const map = new TraceMap(JSON.parse(readFileSync(VENCORD + "/dist/renderer.js.map", "utf8")));

const profile = JSON.parse(readFileSync("scroll-profile.cpuprofile", "utf8"));
const nodes = new Map(profile.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));

const describe = cf => {
    if (/VencordRenderer/.test(cf.url)) {
        const p = originalPositionFor(map, { line: cf.lineNumber + 1, column: cf.columnNumber });
        return `VENCORD ${cf.functionName || "(anon)"} @ ${(p.source ?? "?").replace(/^.*?src\//, "")}:${p.line}`;
    }
    return `${cf.functionName || "(anon)"} @ ${(cf.url || "").split("/").pop() || "(native)"}:${cf.lineNumber}:${cf.columnNumber}`;
};

for (const target of ["get scrollTop", "setAttribute", "get offsetHeight", "getBoundingClientRect", "get clientHeight", "getComputedStyle"]) {
    const chains = new Map();
    let total = 0;
    for (const [id, t] of self) {
        const n = nodes.get(id);
        if (n.callFrame.functionName !== target) continue;
        total += t;
        // walk up to the first 4 non-native frames
        const chain = [];
        let cur = parent.get(id);
        while (cur && chain.length < 5) {
            const cf = nodes.get(cur).callFrame;
            if (cf.url || cf.functionName === "(root)") chain.push(describe(cf));
            cur = parent.get(cur);
        }
        const key = chain.join("  <-  ");
        chains.set(key, (chains.get(key) ?? 0) + t);
    }
    if (!total) continue;
    console.log(`\n### ${target}: ${(total / 1000).toFixed(1)} ms self`);
    for (const [k, v] of [...chains.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
        console.log(`${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`);
}

// frame pacing from the trace
const trace = JSON.parse(readFileSync("scroll-trace.json", "utf8")).traceEvents;
const draws = trace.filter(e => e.name === "DrawFrame").map(e => e.ts).sort((a, b) => a - b);
const gaps = draws.slice(1).map((t, i) => (t - draws[i]) / 1000).sort((a, b) => a - b);
const pct = p => gaps[Math.floor(gaps.length * p)]?.toFixed(1);
console.log(`\n### frame gaps (ms): n=${gaps.length} p50=${pct(0.5)} p90=${pct(0.9)} p99=${pct(0.99)} max=${gaps.at(-1)?.toFixed(1)}  (165Hz=6.1, 60Hz=16.7)`);
const layerize = trace.filter(e => e.name === "Layerize" && e.dur).map(e => e.dur / 1000);
const paints = trace.filter(e => e.name === "Paint" && e.dur).map(e => e.dur / 1000);
console.log(`Layerize: n=${layerize.length} avg=${(layerize.reduce((a, b) => a + b, 0) / layerize.length).toFixed(2)} ms | Paint: n=${paints.length} avg=${(paints.reduce((a, b) => a + b, 0) / paints.length).toFixed(2)} ms`);
const recalcs = trace.filter(e => e.name === "UpdateLayoutTree" && e.dur).sort((a, b) => b.dur - a.dur).slice(0, 5);
console.log("slowest style recalcs:", recalcs.map(e => `${(e.dur / 1000).toFixed(1)}ms/${e.args?.elementCount ?? "?"}el`).join(", "));
