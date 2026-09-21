# Ghosted

A [Vencord](https://vencord.dev) userplugin that flags DMs you've **read but never replied to**.

Discord only badges *unread* DMs. Read one first thing in the morning, think "I'll answer later", and it looks exactly like a finished conversation. Ghosted puts a small ghost + age (`6h`) on the DM row in the sidebar until you reply.

- Counts a 1:1 DM as ghosted when: they sent the last message, you've read it, and N hours passed (default 2).
- Cleared by: sending a message, reacting to their message (toggleable), or right-click → **Not ghosting** / **Snooze ghost 24h**.
- On startup it fetches the last message of your ~30 most recent DMs so ghosts from before install show up immediately (configurable; 0 disables).
- **Sort by ghosted** row in the DM list (under Quests): click to reorder DMs with the longest-ghosted person on top; click again to restore Discord's order. Shows how many people you're ghosting.
- Bots ignored by default. Group DMs and servers are not tracked. DMs pinned with PinDMs stay in their categories.

## Install

Userplugins need a Vencord built from source — the stock installer build can't load them. Takes about 5 minutes on a fresh machine.

### Windows, from nothing

Open **PowerShell** (Start → type `powershell` → Enter). Paste each block, wait for it to finish.

**1. Tools** — Git, Node.js (needs 22 or newer), pnpm:

```powershell
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
```

Close PowerShell and open a new one so it picks up the new tools, then:

```powershell
npm install -g pnpm
```

If PowerShell complains that *running scripts is disabled on this system*:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**2. Vencord + plugin** — this puts everything in `C:\Users\<you>\Vencord`:

```powershell
cd ~
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
git clone https://github.com/watchthelight/vencord-ghosted src/userplugins/ghosted
pnpm build
```

(`pnpm install` may say it's downloading a newer pnpm — that's expected, let it.)

**3. Inject** — fully quit Discord first (tray icon → Quit Discord), then:

```powershell
pnpm inject
```

Pick your Discord install when asked (Stable, PTB or Canary). It downloads a small installer, patches Discord to load this build, and says *Success*.

**4. Enable** — open Discord → User Settings → **Vencord → Plugins** → search `Ghosted` → toggle on → press Ctrl+R.

Your existing Vencord settings, themes and plugins carry over — they live in `%AppData%\Vencord`, not in the build.

### Already building Vencord from source?

Only these are new:

```sh
git clone https://github.com/watchthelight/vencord-ghosted src/userplugins/ghosted
pnpm build
```

### macOS / Linux

Same steps; install Git, Node ≥ 22 and pnpm with your package manager (`brew install git node pnpm` on macOS), then follow **2–4**.

### Update

```powershell
cd ~/Vencord/src/userplugins/ghosted
git pull
cd ~/Vencord
pnpm build
```

Ctrl+R in Discord afterwards. To update Vencord itself, `git pull` in `~/Vencord` too, then `pnpm install --frozen-lockfile && pnpm build`.

### Uninstall

Delete `~/Vencord/src/userplugins/ghosted`, run `pnpm build`. To go back to stock Vencord: `pnpm uninject` then re-run the normal Vencord installer.

### Troubleshooting

- `pnpm : File ... cannot be loaded because running scripts is disabled` → the `Set-ExecutionPolicy` line above.
- `error: No such built-in module: node:sqlite` or `engines: node >= 22` → Node too old. `node --version` should print v22 or higher; reinstall Node LTS.
- `git` / `node` / `pnpm` "not recognized" → open a new PowerShell window; the PATH only updates for new windows.
- `pnpm inject` says Discord is running → quit it from the tray icon, not just the X button.
- Plugin not in the list → you're running stock Vencord, not this build. Re-run `pnpm inject`.

## Settings

| Setting | Default | |
|---|---|---|
| Hours before ghosted | 2 | 0 = flag immediately |
| Also flag unread DMs | off | Discord already badges those |
| Ignore bots | on | |
| Reaction counts as reply | on | |
| DMs to fetch on startup | 30 | 0 = never call the API, track from now on only |
| Show age next to icon | on | |
| Show 'Sort by ghosted' row | on | |

## Theming

Badge is `.vc-ghosted-badge`, the nav row `.vc-ghosted-sort-row`. Colours:

```css
:root {
    --vc-ghosted-color: #ffd257; /* base */
    --vc-ghosted-shine: #fff7d6; /* highlight that sweeps across */
}
```

The sweep animation is off under `prefers-reduced-motion`.

## How it works

Tracks the last message per DM from Discord's own flux events (`MESSAGE_CREATE`, `MESSAGE_DELETE`, reactions, message loads), persists it in Vencord's DataStore, and renders through Vencord's `MemberListDecorators` API — no fragile patches to Discord's DM list. Read state comes from `ReadStateStore.ackMessageId`, ignored while Discord marks it as estimated (right after reconnect).

## License

GPL-3.0-or-later, same as Vencord.
