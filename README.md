# Ghosted

A [Vencord](https://vencord.dev) userplugin that flags DMs you've **read but never replied to**.

Discord only badges *unread* DMs. Read one first thing in the morning, think "I'll answer later", and it looks exactly like a finished conversation. Ghosted puts a small ghost + age (`6h`) on the DM row in the sidebar until you reply.

- Counts a 1:1 DM as ghosted when: they sent the last message, you've read it, and N hours passed (default 2).
- Cleared by: sending a message, reacting to their message (toggleable), or right-click → **Not ghosting** / **Snooze ghost 24h**.
- On startup it fetches the last message of your ~30 most recent DMs so ghosts from before install show up immediately (configurable; 0 disables).
- **Sort by ghosted** row in the DM list (under Quests): click to reorder DMs with the longest-ghosted person on top; click again to restore Discord's order. Shows how many people you're ghosting.
- Bots ignored by default. Group DMs and servers are not tracked. DMs pinned with PinDMs stay in their categories.

## Install

Userplugins need a Vencord built from source — the stock installer build can't load them.

```sh
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
git clone https://github.com/watchthelight/vencord-ghosted src/userplugins/ghosted
pnpm build
pnpm inject     # close Discord first; picks your Discord install and points it at this build
```

Needs Node ≥ 22 and pnpm. Then in Discord: **Settings → Vencord → Plugins → Ghosted → enable**, Ctrl+R.

Already building Vencord from source? Only the `git clone ... src/userplugins/ghosted` and `pnpm build` steps are new.

### Update

```sh
cd src/userplugins/ghosted && git pull && cd ../../.. && pnpm build
```

### Uninstall

Delete `src/userplugins/ghosted`, `pnpm build`. `pnpm uninject` if you want stock Vencord back.

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
