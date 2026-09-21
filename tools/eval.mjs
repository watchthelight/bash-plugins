// node eval.mjs "<js expression>"  -> evaluates in the PTB page, prints the value
const targets = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = targets.find(t => t.type === "page" && t.url.includes("discord.com/channels"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { returnByValue: true, awaitPromise: true, expression: process.argv[2] } }));
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === 1) { console.log(m.result?.exceptionDetails ? "ERROR " + m.result.exceptionDetails.text : JSON.stringify(m.result?.result?.value)); ws.close(); } };
