# Profiling tools

Scripts used to measure Discord's scroll performance from outside the client. They talk to Discord over the Chrome DevTools Protocol, so PTB (or stable) has to be started with a debugging port:

```powershell
& "$env:LOCALAPPDATA\DiscordPTB\Update.exe" --processStart DiscordPTB.exe --process-start-args --remote-debugging-port=9229
```

Keep the window visible (not minimized) while measuring, otherwise requestAnimationFrame stops and the probes wait forever. Run with Node 22 or newer from this folder:

| Script | What it does |
|---|---|
| `scroll-profile.mjs [ms]` | Wheel-scrolls the open channel up then down for `ms` each way while recording a trace and a JS CPU profile. Prints frames drawn, main thread time by phase, and JS self time attributed to Vencord plugins through the source map. Writes `scroll-trace.json` and `scroll-profile.cpuprofile`. |
| `analyze-callers.mjs` | Reads those two files. Shows who calls the hot native getters (`scrollTop` and friends), frame gap percentiles, and the slowest style recalcs. |
| `gpu-info.mjs` | GPU in use, compositing feature status, and the full Chromium command line. |
| `sheets.mjs` | Stylesheet and rule counts by owner (Discord, Vencord, themes). |
| `eval.mjs "<expression>"` | Evaluate JavaScript in the page. Handy for A/B runs, for example `node eval.mjs "Vencord.Settings.enabledThemes = []"`. |

Do not add the `disabled-by-default-blink.debug` or invalidation tracking categories to the trace config. They flood the connection and the trace never completes.
