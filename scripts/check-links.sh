#!/usr/bin/env bash
# Link checks on the built site (#28). Run `pnpm build` first. Settings: lychee.toml.
#
#   scripts/check-links.sh internal   every link between files in dist/ and every #anchor,
#                                     offline. The site's own absolute URLs (canonical,
#                                     sitemap, feeds, /menu.txt) are mapped onto dist/, so
#                                     they're checked too. An extensionless page link
#                                     maps to its .html (`build.format: 'file'`), so
#                                     /writing is writing.html, not the writing/ folder.
#                                     Blocking.
#   scripts/check-links.sh external   only links off the site, over the network. Weekly.
#
# Extra arguments go to lychee (e.g. --format markdown --output report.md).
set -euo pipefail

mode="${1:-}"
shift || true
root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$root/dist"
[ -f "$dist/index.html" ] || {
  echo "dist/ has no index.html. Run \`pnpm build\` first." >&2
  exit 1
}

case "$mode" in
  internal)
    exec lychee --config "$root/lychee.toml" --offline --root-dir "$dist" \
      --remap "^https://ablation\\.kitchen/((?:[^#?]*/)?[^/#?.]+)(#.*)?\$ file://$dist/\$1.html\$2" \
      --remap "^https://ablation\\.kitchen/(.*)\$ file://$dist/\$1" \
      --remap "^(file://$dist/(?:[^#?]*/)?[^/#?.]+)(#.*)?\$ \$1.html\$2" \
      "$@" "$dist"
    ;;
  external)
    exec lychee --config "$root/lychee.toml" --root-dir "$dist" --scheme https --scheme http \
      --exclude '^https://ablation\.kitchen(/|$)' \
      "$@" "$dist"
    ;;
  *)
    echo "usage: $0 internal|external [lychee args]" >&2
    exit 2
    ;;
esac
