#!/usr/bin/env bash
# Rebuilds the BRAT-style layout used by ddspog/testing-vault:
#
#   <vault>/.obsidian/plugins/obsidian-rpg-ui  ->  this plugin repo
#
# The vault's .gitignore already ignores that path, so both repos stay separate and
# can each be committed and pushed. A bind mount is used instead of a symlink because
# scripts/sync-vault.mjs derives the vault root from the plugin's real path (../../..).
#
# Usage: scripts/mount-vault.sh [vault-dir]   (default: ../testing-vault next to this repo)
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT_DIR="${1:-$(dirname "$PLUGIN_ROOT")/testing-vault}"
VAULT_REPO="${VAULT_REPO:-https://github.com/ddspog/testing-vault}"
TARGET="$VAULT_DIR/.obsidian/plugins/obsidian-rpg-ui"

if [ ! -d "$VAULT_DIR/.git" ]; then
  git clone --depth 1 "$VAULT_REPO" "$VAULT_DIR"
fi

mkdir -p "$TARGET"
if mountpoint -q "$TARGET"; then
  echo "already mounted: $TARGET"
else
  mount --bind "$PLUGIN_ROOT" "$TARGET"
  echo "mounted $PLUGIN_ROOT -> $TARGET"
fi
echo "Run plugin scripts from $TARGET so the vault root resolves correctly."
