// GPU / compositing status of the running PTB, via the browser-level CDP target.
const v = await (await fetch("http://127.0.0.1:9229/json/version")).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(res => { const id = Date.now() % 100000; ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === id) res(m.result); }; ws.send(JSON.stringify({ id, method, params })); });
const info = await send("SystemInfo.getInfo");
ws.close();
console.log("Browser:", v.Browser, "| Electron user agent:", v["User-Agent"]?.match(/Electron\/[\d.]+/)?.[0]);
console.log("GPU devices:", info.gpu.devices.map(d => `${d.vendorString ?? d.vendorId} ${d.deviceString ?? d.deviceId} (${d.driverVersion ?? ""})`).join(" | "));
console.log("aux:", JSON.stringify(Object.fromEntries(Object.entries(info.gpu.auxAttributes ?? {}).filter(([k]) => /software|gl_|angle|renderer|passthrough|skia|direct_composition|supports_overlays|overlay|nv12|yuy2/i.test(k)))));
console.log("feature status:");
for (const [k, val] of Object.entries(info.gpu.featureStatus ?? {})) console.log(`  ${k.padEnd(40)} ${val}`);
console.log("driver bug workarounds:", (info.gpu.driverBugWorkarounds ?? []).length);
console.log("command line:", info.commandLine);
