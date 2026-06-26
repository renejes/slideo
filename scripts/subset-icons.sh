#!/usr/bin/env bash
#
# Subsettet die Material-Symbols-Font auf die in scripts/icon-names.txt gelisteten
# Icons (Audit P1) und erzeugt:
#   - src/assets/material-symbols-subset.woff2   (~42 KB statt ~3,63 MB)
#   - src/lib/icon-codepoints.ts                 (Name -> Codepoint, für Icon.tsx)
#
# Voraussetzungen: `npm install` (für node_modules/material-symbols) und pyftsubset
# (fonttools) + brotli im selben Python. Aufruf: `npm run icons:subset`.
#
# WICHTIG: Wird ein NEUES Icon in der App verwendet, seinen Material-Symbols-Namen zu
# scripts/icon-names.txt hinzufügen und dieses Script neu ausführen. Fehlt ein Icon im
# Subset, rendert Icon.tsx den Namen als Klartext (sichtbarer Hinweis) statt des Symbols.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FONT="$ROOT/node_modules/material-symbols/material-symbols-outlined.woff2"
NAMES="$ROOT/scripts/icon-names.txt"
TS_OUT="$ROOT/src/lib/icon-codepoints.ts"
OUT="$ROOT/src/assets/material-symbols-subset.woff2"

if [ ! -f "$FONT" ]; then
  echo "Font nicht gefunden ($FONT). Erst 'npm install' ausführen." >&2
  exit 1
fi
if ! command -v pyftsubset >/dev/null 2>&1; then
  echo "pyftsubset fehlt. Installieren: pip install fonttools brotli" >&2
  exit 1
fi
PYBIN="$(head -1 "$(command -v pyftsubset)" | sed 's/^#!//')"

UNICODES="$("$PYBIN" "$ROOT/scripts/extract-icons.py" "$FONT" "$NAMES" "$TS_OUT")"
pyftsubset "$FONT" \
  --unicodes="$UNICODES" \
  --layout-features='' \
  --flavor=woff2 \
  --output-file="$OUT"

echo "icons: subset -> $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes); map -> $TS_OUT"
