// Who owns the stylesheets in the PTB renderer?
const targets = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = targets.find(t => t.type === "page" && t.url.includes("discord.com/channels"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(res => { const id = 1 + Math.floor(Math.random() * 1e6); const h = ev => { const m = JSON.parse(ev.data); if (m.id === id) { ws.removeEventListener("message", h); res(m.result); } }; ws.addEventListener("message", h); ws.send(JSON.stringify({ id, method, params })); });
const r = await send("Runtime.evaluate", { returnByValue: true, expression: `(() => {
    const out = { total: 0, byOwner: {}, top: [], attrSelectors: 0, notSelectors: 0, universal: 0, themeRules: 0, vencordRules: 0, discordRules: 0 };
    const sheets = [...document.styleSheets];
    out.total = sheets.length;
    for (const s of sheets) {
        let rules; try { rules = s.cssRules; } catch { continue; }
        const n = s.ownerNode;
        const id = n?.id || "";
        const tag = n?.tagName?.toLowerCase() || "?";
        const cls = n?.className || "";
        const attrs = n ? [...n.attributes].filter(a => a.name !== "id").map(a => a.name + (a.value && a.value.length < 30 ? "=" + a.value : "")).join(",") : "";
        let key;
        if (id.startsWith("vencord-")) key = "vencord:" + id;
        else if (n?.hasAttribute?.("vencord-managed-style") || n?.getAttribute?.("data-vencord")) key = "vencord-managed";
        else if (id === "vencord-themes" || id.includes("theme")) key = "theme:" + id;
        else if (tag === "link") key = "link:" + (n.href || "").split("/").pop().slice(0, 40);
        else key = "style[" + attrs.slice(0, 40) + "]" + (cls ? "." + cls : "");
        const cnt = rules.length;
        const b = out.byOwner[key] ??= { sheets: 0, rules: 0 };
        b.sheets++; b.rules += cnt;
        if (/^vencord|theme/.test(key)) out.vencordRules += cnt; else out.discordRules += cnt;
        out.top.push([cnt, key, (rules[0]?.cssText || "").slice(0, 80)]);
        for (const rule of rules) {
            const sel = rule.selectorText; if (!sel) continue;
            if (sel.includes("[class")) out.attrSelectors++;
            if (sel.includes(":not(")) out.notSelectors++;
            if (/(^|[\\s,>~+])\\*/.test(sel)) out.universal++;
        }
    }
    out.top.sort((a, b) => b[0] - a[0]); out.top = out.top.slice(0, 12);
    return out;
})()` });
ws.close();
const v = r.result.value;
console.log("sheets:", v.total, "| discord rules:", v.discordRules, "| vencord+theme rules:", v.vencordRules);
console.log("selectors with [class*=]:", v.attrSelectors, "| with :not():", v.notSelectors, "| universal *:", v.universal);
console.log("\nby owner (sheets, rules):");
for (const [k, b] of Object.entries(v.byOwner).sort((a, b) => b[1].rules - a[1].rules).slice(0, 25)) console.log(`${String(b.sheets).padStart(5)} ${String(b.rules).padStart(7)}  ${k}`);
console.log("\nbiggest sheets:");
for (const [n, k, first] of v.top) console.log(`${String(n).padStart(7)}  ${k}  | ${first}`);
