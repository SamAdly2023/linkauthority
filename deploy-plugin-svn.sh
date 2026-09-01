#!/usr/bin/env bash
#
# Publishes linkauthority-partners to the WordPress.org plugin directory.
#
# Run from the repo root in Git Bash, after:
#   1. installing an SVN client (see below), and
#   2. setting your SVN password at
#      https://profiles.wordpress.org/me/profile/edit/group/3/?screen=svn-password
#
# It stages everything and STOPS before the commit, so you can inspect exactly
# what is about to become public. The two commit commands are printed at the end.

set -e

SLUG="linkauthority-partners"
VERSION="1.0.9"
WPORG_USER="samadly728"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$REPO_ROOT/$SLUG"
ASSETS_DIR="$REPO_ROOT/$SLUG-assets"
CHECKOUT="$REPO_ROOT/../$SLUG-svn"

if ! command -v svn >/dev/null 2>&1; then
  echo "ERROR: no svn client found."
  echo
  echo "Install one, then re-run this script:"
  echo "  winget install TortoiseSVN.TortoiseSVN"
  echo "  (during setup, enable 'command line client tools' - it is off by default)"
  echo
  echo "Then close and reopen your terminal so svn is on PATH."
  exit 1
fi

[ -d "$PLUGIN_DIR" ] || { echo "ERROR: $PLUGIN_DIR not found"; exit 1; }
[ -d "$ASSETS_DIR" ] || { echo "ERROR: $ASSETS_DIR not found"; exit 1; }

echo "==> Checking out https://plugins.svn.wordpress.org/$SLUG"
if [ -d "$CHECKOUT/.svn" ]; then
  svn update "$CHECKOUT"
else
  svn checkout "https://plugins.svn.wordpress.org/$SLUG" "$CHECKOUT" --username "$WPORG_USER"
fi

echo "==> Staging plugin files into trunk/"
mkdir -p "$CHECKOUT/trunk"
# --delete so files removed from the repo also leave trunk on later releases.
rsync -a --delete --exclude '.svn' "$PLUGIN_DIR/" "$CHECKOUT/trunk/"

echo "==> Staging directory assets into assets/"
mkdir -p "$CHECKOUT/assets"
cp "$ASSETS_DIR"/*.png "$CHECKOUT/assets/"

echo "==> Marking new files for addition"
cd "$CHECKOUT"
svn add --force trunk assets >/dev/null 2>&1 || true
# Anything deleted locally needs marking too.
svn status | awk '/^!/ {print $2}' | while read -r missing; do
  [ -n "$missing" ] && svn rm --force "$missing" >/dev/null 2>&1 || true
done

echo
echo "==> Staged. Nothing has been published yet."
echo
svn status
echo
echo "-------------------------------------------------------------------"
echo "Review the list above, then run these two commands from:"
echo "  $CHECKOUT"
echo
echo "  svn commit -m \"Release $VERSION\" --username $WPORG_USER"
echo "  svn copy trunk \"tags/$VERSION\" && svn commit -m \"Tag $VERSION\" --username $WPORG_USER"
echo
echo "The public page appears at https://wordpress.org/plugins/$SLUG"
echo "within minutes of the first commit."
echo "-------------------------------------------------------------------"
