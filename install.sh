#!/usr/bin/env bash
# Installs Vencord from source plus Bash's plugins on macOS or Linux.
# Needs git, node 22+, pnpm.  Usage:  curl -fsSL https://raw.githubusercontent.com/watchthelight/bash-plugins/main/install.sh | bash
set -euo pipefail

VENCORD_DIR="$HOME/Vencord"
PLUGINS_REPO="https://github.com/watchthelight/bash-plugins"
REPO_DIR="$VENCORD_DIR/src/userplugins/.bash-plugins"

for tool in git node pnpm; do
    command -v "$tool" >/dev/null 2>&1 || { echo "Missing $tool. On macOS: brew install git node pnpm"; exit 1; }
done
node_major=$(node --version | sed 's/^v//' | cut -d. -f1)
if [ "$node_major" -lt 22 ]; then
    echo "Node $node_major is too old, Vencord needs 22 or newer."
    exit 1
fi

echo "== Vencord =="
if [ ! -f "$VENCORD_DIR/package.json" ]; then
    git clone --quiet https://github.com/Vendicated/Vencord "$VENCORD_DIR"
else
    echo "Vencord already at $VENCORD_DIR"
fi
cd "$VENCORD_DIR"
pnpm install --frozen-lockfile

echo "== Bash's plugins =="
if [ ! -d "$REPO_DIR/.git" ]; then
    git clone --quiet "$PLUGINS_REPO" "$REPO_DIR"
else
    git -C "$REPO_DIR" pull --ff-only --quiet
fi
for dir in "$REPO_DIR"/*/; do
    name=$(basename "$dir")
    case "$name" in .*|_*) continue ;; esac
    [ -f "$dir/index.tsx" ] || [ -f "$dir/index.ts" ] || continue
    link="$VENCORD_DIR/src/userplugins/$name"
    if [ ! -e "$link" ]; then
        ln -s "$dir" "$link"
        echo "Linked $name"
    fi
done

echo "== Build =="
pnpm build

echo
echo "Done. Quit Discord completely, then run 'pnpm inject' in $VENCORD_DIR."
echo "After that: User Settings > Vencord > Plugins, turn on the ones you want, press Ctrl+R once."
