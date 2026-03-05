#!/bin/bash
set -e

echo ""
echo "⚡ AI Papers Daily — Deploy Script"
echo "─────────────────────────────────────"

# 1. Get GitHub username
GH_USER=$(gh api user --jq '.login' 2>/dev/null)
if [ -z "$GH_USER" ]; then
  echo "❌  gh CLI not authenticated. Run: gh auth login"
  exit 1
fi
echo "✓  Logged in as: $GH_USER"

# 2. Update vite.config.js base path to match repo name
sed -i "s|base: '/ai-papers-daily/'|base: '/ai-papers-daily/'|g" vite.config.js
echo "✓  vite.config.js base = /ai-papers-daily/"

# 3. Install dependencies
echo "→  Installing dependencies…"
npm install --silent

# 4. Init git and create GitHub repo
if [ ! -d ".git" ]; then
  git init
  git add -A
  git commit -m "Initial commit: AI Papers Daily"
  gh repo create ai-papers-daily --public --source=. --remote=origin --push
  echo "✓  Repo created: https://github.com/$GH_USER/ai-papers-daily"
else
  git add -A
  git commit -m "Update" 2>/dev/null || echo "  (nothing new to commit)"
  git push origin main 2>/dev/null || git push origin master 2>/dev/null || true
  echo "✓  Pushed to existing repo"
fi

# 5. Deploy to GitHub Pages
echo "→  Building and deploying to GitHub Pages…"
npm run deploy

echo ""
echo "✅  Done! Your site will be live in ~60 seconds at:"
echo "    https://$GH_USER.github.io/ai-papers-daily/"
echo ""
