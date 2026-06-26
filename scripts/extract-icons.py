"""Extrahiert Material-Symbols-Codepoints für die in der App genutzten Icon-Namen.

Schreibt `src/lib/icon-codepoints.ts` (Name -> PUA-Codepoint) und gibt die
Unicodes-Liste (`U+XXXX,...`) auf stdout aus, die `scripts/subset-icons.sh` an
pyftsubset weiterreicht. Wird über `npm run icons:subset` aufgerufen.

Hintergrund (Audit P1): Material Symbols ist eine Ligatur-Icon-Font. Per `--text`
zu subsetten zieht über die Buchstaben-Schließung ALLE Icons herein (~3,4 MB).
Deshalb rendern wir per Codepoint und subsetten per `--unicodes` → ~42 KB.
"""
import json
import sys
from fontTools.ttLib import TTFont

font_path, names_path, ts_out = sys.argv[1], sys.argv[2], sys.argv[3]
names = [
    line.strip()
    for line in open(names_path, encoding="utf-8")
    if line.strip() and not line.startswith("#")
]

font = TTFont(font_path)
cmap = font.getBestCmap()  # codepoint -> glyphname
glyph2cp = {}
for cp, gn in cmap.items():
    glyph2cp.setdefault(gn, cp)  # erster Codepoint je Glyph (PUA bei Icons)
glyph2char = {gn: chr(cp) for cp, gn in cmap.items()}  # Buchstaben-Glyph -> Zeichen


def ligature_subtables(gsub):
    for lookup in gsub.LookupList.Lookup:
        if lookup.LookupType == 4:  # Ligature
            yield from lookup.SubTable
        elif lookup.LookupType == 7:  # Extension -> evtl. Type 4
            for st in lookup.SubTable:
                if getattr(st, "ExtensionLookupType", None) == 4:
                    yield st.ExtSubTable


name2glyph = {}
for st in ligature_subtables(font["GSUB"].table):
    for first, ligs in st.ligatures.items():
        for lig in ligs:
            comps = [first] + list(lig.Component)
            try:
                s = "".join(glyph2char[g] for g in comps)
            except KeyError:
                continue
            name2glyph[s] = lig.LigGlyph

resolved, unresolved = {}, []
for n in names:
    g = name2glyph.get(n)
    cp = glyph2cp.get(g) if g else None
    if cp is not None:
        resolved[n] = cp
    else:
        unresolved.append(n)

with open(ts_out, "w", encoding="utf-8") as f:
    f.write("// AUTO-GENERIERT von scripts/subset-icons.sh — NICHT von Hand editieren.\n")
    f.write("// Material-Symbols-Name -> PUA-Codepoint (Hex). Render: String.fromCodePoint(parseInt(cp, 16)).\n")
    f.write("export const ICON_CODEPOINTS: Record<string, string> = {\n")
    for n in sorted(resolved):
        f.write(f'  {json.dumps(n)}: {json.dumps("%04x" % resolved[n])},\n')
    f.write("}\n")

if unresolved:
    sys.stderr.write(f"WARN: keine echten Material Symbols (übersprungen): {unresolved}\n")
print(",".join("U+%04X" % cp for cp in sorted(set(resolved.values()))))
