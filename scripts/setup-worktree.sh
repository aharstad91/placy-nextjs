#!/bin/bash
# Setup a git worktree for parallel development
# Symlinks shared config files and installs dependencies
#
# Usage:
#   From the worktree directory:
#     ../placy-ralph/scripts/setup-worktree.sh
#
#   Or with explicit main repo path:
#     /path/to/placy-ralph/scripts/setup-worktree.sh

set -e

# Resolve main repo path (where this script lives)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAIN_REPO="$(dirname "$SCRIPT_DIR")"

# Current directory should be the worktree
WORKTREE_DIR="$(pwd)"

if [ "$WORKTREE_DIR" = "$MAIN_REPO" ]; then
  echo "Error: Run this from the worktree directory, not the main repo."
  exit 1
fi

echo "Setting up worktree: $WORKTREE_DIR"
echo "Main repo: $MAIN_REPO"

# 1. Symlink .env.local
if [ -f "$WORKTREE_DIR/.env.local" ]; then
  echo "✓ .env.local already exists"
else
  ln -s "$MAIN_REPO/.env.local" "$WORKTREE_DIR/.env.local"
  echo "✓ Symlinked .env.local"
fi

# 2. Install dependencies (if needed)
if [ ! -d "$WORKTREE_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  echo "✓ Dependencies installed"
else
  echo "✓ node_modules already exists"
fi

# 3. Clean .next cache (avoids stale cache errors)
if [ -d "$WORKTREE_DIR/.next" ]; then
  rm -rf "$WORKTREE_DIR/.next"
  echo "✓ Cleaned .next cache"
fi

echo ""
echo "Done! Start dev server with: npm run dev"
