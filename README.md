# Bash's plugins for Vencord

A few plugins I wrote for my own Discord, packaged so friends can install all of them at once and keep them updated from inside Discord. Each one is a normal Vencord plugin with its own toggle in Settings, so you can run any mix of them.

| Plugin | What it does |
|---|---|
| **Ghosted** | Marks DMs you read but never answered. A ghost and a timer appear on the DM row until you reply, react, or dismiss it. A "Sort by ghosted" row in the DM list puts the person who has waited longest on top. |
| **Turbo** | Makes Discord feel instant. Popouts, modals, menus and folders finish animating immediately, GIFs and animated emoji stay still until you hover, and a few Chromium flags stop the app from throttling itself. Includes a report that lists what else in your setup is costing frames, with one click fixes. |
| **MultiSend** | Say good morning to everyone at once without it looking like a broadcast. Pick people, write one message (with variants and their name filled in), and it goes out one DM at a time with a few seconds between each, typing indicator first. Button next to the chat box, or `/multisend`. |
| **ServerExitWizard** | Lists your servers by how long since you last opened them, with member counts and join dates. Tick the dead ones, leave them in one go, and keep a list of what you left with invite links where a public one exists. `/serverexit` or the button in its settings. |
| **BashPlugins** | The updater. Shows which of these plugins you have, checks GitHub for new commits, and pulls, rebuilds and reloads without leaving Discord. |

## Install

Vencord has to be built from source for user plugins to load. The stock installer build cannot see them. The script below handles everything on a fresh Windows machine, including Git and Node if you don't have them.

### Windows

Open PowerShell (Start, type `powershell`, Enter) and paste:

```powershell
irm https://raw.githubusercontent.com/watchthelight/bash-plugins/main/install.ps1 | iex
```

It will:

1. Install Git and Node.js through winget if they are missing, and pnpm through npm.
2. Clone Vencord to `C:\Users\<you>\Vencord` and install its dependencies.
3. Clone this repo into `Vencord\src\userplugins\.bash-plugins` and link each plugin folder into place.
4. Build Vencord.
5. Ask whether to inject into Discord now. Fully quit Discord first (tray icon, Quit Discord), then answer `y`.

Afterwards open Discord, go to User Settings, Vencord, Plugins, and turn on the ones you want. Press Ctrl+R once.

If the first line fails with a message about scripts being disabled, run this once and try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### macOS and Linux

You need Git, Node 22 or newer, and pnpm (`brew install git node pnpm` on macOS). Then:

```sh
curl -fsSL https://raw.githubusercontent.com/watchthelight/bash-plugins/main/install.sh | bash
```

### Already building Vencord from source?

Only two steps are new. From your Vencord folder:

```sh
git clone https://github.com/watchthelight/bash-plugins src/userplugins/.bash-plugins
```

Then link each plugin folder into `src/userplugins`. On Windows (PowerShell):

```powershell
Get-ChildItem src\userplugins\.bash-plugins -Directory | Where-Object { $_.Name -notmatch '^[._]' } | ForEach-Object {
    New-Item -ItemType Junction -Path "src\userplugins\$($_.Name)" -Target $_.FullName
}
```

On macOS or Linux:

```sh
for d in src/userplugins/.bash-plugins/*/; do ln -s "$PWD/$d" "src/userplugins/$(basename "$d")"; done
```

Run `pnpm build`, restart Discord, enable what you want.

## Updating

Open User Settings, Vencord, Plugins, BashPlugins. Press "Check for updates", then "Update and rebuild". Discord asks to reload when the build finishes. With "check on startup" on (the default) it tells you when something new is available; turn on "update automatically" if you don't want to press anything.

From a terminal it's the same as any git checkout:

```sh
cd ~/Vencord/src/userplugins/.bash-plugins && git pull
cd ~/Vencord && pnpm build
```

## Why the odd folder name

Vencord only looks one level deep in `src/userplugins` and treats every folder there as a plugin, but it skips names starting with a dot. So the repo lives in `.bash-plugins`, invisible to the build, and each plugin inside it is exposed with a junction (a symlink on macOS and Linux). `git pull` keeps working in the real folder and Vencord sees the plugins as if they were copied in.

## Uninstall

Delete the junctions in `src/userplugins` and the `.bash-plugins` folder, then `pnpm build`. To go back to stock Vencord entirely, run `pnpm uninject` in the Vencord folder and use the normal Vencord installer.

## License

GPL-3.0-or-later, the same as Vencord.
