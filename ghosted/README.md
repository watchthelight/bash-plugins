# Ghosted

A Vencord plugin that flags DMs you read but never answered.

Discord only badges unread DMs. Read one first thing in the morning, think "I'll answer later", and it looks exactly like a finished conversation. Ghosted puts a small ghost and a timer (`6h`) on the DM row in the sidebar until you reply.

- A 1:1 DM counts as ghosted when the other person sent the last message, you have read it, and a set number of hours have passed (default 2).
- It clears when you send a message, react to their message (can be turned off), or right click the DM and pick "Not ghosting" or "Snooze ghost 24h".
- On startup it fetches the last message of your 30 most recent DMs so ghosts from before you installed it show up right away. That number is a setting, and 0 turns the fetch off.
- The "Sort by ghosted" row in the DM list, just under Quests, reorders DMs with the person who has waited longest on top. Click it again to go back to Discord's order. It shows how many people you're ghosting.
- Bots are ignored by default. Group DMs and servers are not tracked. DMs pinned with PinDMs stay in their categories and are sorted inside them.

## Install

This plugin ships as part of [bash-plugins](https://github.com/watchthelight/bash-plugins). The README there covers installing on a fresh machine and updating from inside Discord.

## Settings

| Setting | Default | |
|---|---|---|
| Hours before ghosted | 2 | 0 flags immediately |
| Also flag unread DMs | off | Discord already badges those |
| Ignore bots | on | |
| Reaction counts as reply | on | |
| DMs to fetch on startup | 30 | 0 never calls the API, tracking starts from install |
| Show age next to icon | on | |
| Show "Sort by ghosted" row | on | |

## Theming

The badge is `.vc-ghosted-badge`, the nav row is `.vc-ghosted-sort-row`. Colours:

```css
:root {
    --vc-ghosted-color: #ffd257; /* base */
    --vc-ghosted-shine: #fff7d6; /* highlight that sweeps across on hover */
}
```

The sweep is off under `prefers-reduced-motion`.

## How it works

It tracks the last message per DM from Discord's own flux events (`MESSAGE_CREATE`, `MESSAGE_DELETE`, reactions, message loads), keeps that in Vencord's DataStore, and draws the badge through Vencord's `MemberListDecorators` API, so there are no fragile patches into Discord's DM list. Read state comes from `ReadStateStore.ackMessageId` and is ignored while Discord marks it as estimated (right after a reconnect).

## License

GPL-3.0-or-later, the same as Vencord.
