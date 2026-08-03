// Findet Oberflächentext, der noch NICHT im Katalog liegt.
//
// Warum kein ESLint: das Projekt hat keins, und die einschlägigen Regeln
// (`react/jsx-no-literals`, `i18next/no-literal-string`) fangen hier massenhaft
// Icon-Namen, Tailwind-Klassen, `data-*` und Token-Schlüssel mit. Umgekehrt ist
// ein naives Umlaut-Regex nutzlos: es trifft überwiegend die (deutsch bleibenden)
// Dev-Kommentare und übersieht „Speichern", „Kopiert.", „Neue Folie".
//
// Warum der TypeScript-Parser und kein Regex: In `.tsx` ist JSX-Text von einem
// Generic nicht durch ein Muster zu trennen — `useState<Foo>(null)` sieht aus wie
// ein Textknoten zwischen zwei Tags, und JSX-Text ist in diesem Code fast immer
// mehrzeilig. Eine Regex-Fassung dieses Skripts meldete deshalb erst 40 reine
// Fehlalarme und übersah bei engerer Fassung eine testweise eingebaute
// Beschriftung vollständig. `ts.createSourceFile` kennt den Unterschied exakt
// und blendet Kommentare von sich aus aus.
//
// Aufgerufen aus `src/i18n/scan.test.ts`, damit das Gate an `npm run build` hängt.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

/** Was gescannt wird. */
const ROOTS = ['src/components', 'src/store', 'src/lib', 'src/App.tsx']

/** Attribute, deren Wert der Nutzer sieht. */
const DISPLAY_ATTRS = new Set(['title', 'aria-label', 'placeholder', 'alt'])

/** Funktionen, die einen freien Anzeigetext entgegennehmen (erstes Argument). */
const MESSAGE_CALLS = new Set(['notify', 'confirmDialog'])

/** Was nie gescannt wird. */
function skip(path) {
  return (
    path.includes('/i18n/') ||
    path.endsWith('.test.ts') ||
    path.endsWith('.test.tsx') ||
    path.endsWith('.d.ts')
  )
}

/**
 * Bewusst NICHT übersetzte Literale (siehe docs/wording.md).
 * Exakter Vergleich nach dem Trimmen — kein Teilstring-Match, sonst wächst hier
 * still eine Hintertür.
 */
const ALLOW = new Set([
  // Marke und Eigennamen
  'Slideo', 'S', 'Claude Desktop', 'Claude Code', 'Meta-MCP', 'Codex CLI',
  'Cursor', 'Windsurf', 'Zed', 'LM Studio', 'PowerPoint', 'Polar',
  // Etablierte Fachbegriffe / Formate
  'Markdown', 'HTML', 'CSS', 'MCP', 'PDF', 'PPTX', 'JSON', 'SVG', 'URL', 'UUID',
  'mcpServers', 'slideo', '.slideo', 'npm run tauri:dev', 'list_assets',
  // Persistierte Daten bzw. API-Werte, die wie Labels aussehen
  'presentation', 'Untitled', '(Kopie)',
  // Format-Schablone des Lizenzschlüssels (sprachneutral, absichtlich literal)
  'SLIDEO-XXXXXXXX-XXXX-XXXX-…',
  // CSS-Beispiel im Hinweis des Custom-CSS-Editors (ZoneCard) — Code, kein Satz
  'h1', 'letter-spacing: -.02em',
  // HTML-Attributname als Feldbeschriftung (Komponenten-Palette, Auto-Animate)
  'data-id',
  // Einheitensuffix der Auto-Advance-Auswahl: "5s", "10s" — in beiden Sprachen "s"
  's',
])

/** Zeichenfolgen, die für sich genommen kein Anzeigetext sind. */
function isBoring(s) {
  if (!s) return true
  if (ALLOW.has(s)) return true
  if (!/[A-Za-zÄÖÜäöüß]/.test(s)) return true // reine Zahlen/Symbole/Interpunktion
  if (/^v?\d[\d.]*$/.test(s)) return true // Versionsnummern
  if (/^var\(--[a-z0-9-]+\)$/.test(s)) return true // CSS-Custom-Property als Beispiel
  return false
}

/** true, wenn der Knoten innerhalb der Funktion `describeError` steht. */
function inDescribeError(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name?.text === 'describeError') return true
  }
  return false
}

function walk(path, out) {
  let st
  try {
    st = statSync(path)
  } catch {
    return // Pfad existiert nicht (umbenannt) — kein Grund, das Gate scheitern zu lassen.
  }
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry), out)
    return
  }
  if (!/\.tsx?$/.test(path) || skip(path)) return
  out.push(path)
}

/**
 * @typedef {{file: string, line: number, kind: string, text: string}} I18nFinding
 * @returns {I18nFinding[]}
 */
export function scanForUntranslated(cwd = process.cwd()) {
  const files = []
  for (const root of ROOTS) walk(join(cwd, root), files)

  const findings = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(
      file,
      src,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    const add = (node, kind, raw) => {
      const text = String(raw).replace(/\s+/g, ' ').trim()
      if (isBoring(text)) return
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      findings.push({
        file: relative(cwd, file),
        line: line + 1,
        kind,
        text: text.length > 90 ? `${text.slice(0, 90)}…` : text,
      })
    }

    const visit = (node) => {
      // 1) Sichtbarer Text zwischen JSX-Tags.
      if (ts.isJsxText(node)) add(node, 'jsx-text', node.text)

      // 2) Anzeige-Attribute mit Literalwert. Ausdrücke ({t('…')}, Template-
      //    Literale, Variablen) sind zur Laufzeit dynamisch; ob ihr Wert übersetzt
      //    ist, entscheidet die Stelle, an der er entsteht.
      if (ts.isJsxAttribute(node) && node.initializer) {
        const name = node.name.getText(sf)
        if (DISPLAY_ATTRS.has(name) && ts.isStringLiteral(node.initializer)) {
          add(node, 'attr', node.initializer.text)
        }
      }

      // 3) Meldungs-APIs mit freiem String als erstem Argument.
      if (ts.isCallExpression(node) && node.arguments.length > 0) {
        const callee = ts.isIdentifier(node.expression) ? node.expression.text : ''
        const first = node.arguments[0]
        if (MESSAGE_CALLS.has(callee) && ts.isStringLiteral(first)) {
          add(node, callee, first.text)
        }
      }

      // 4) Roh angezeigte Backend-Fehler: `x instanceof Error ? x.message : String(x)`.
      //
      // Seit die Rust-Seite handlungsrelevante Fehler als `slideo:<code>` meldet
      // (src-tauri/src/errcode.rs), ist dieses Idiom ein Anzeigefehler: der Nutzer
      // sähe den Maschinencode statt eines Satzes. Genau das ist beim Umbau an
      // fünf Stellen passiert und erst im Review aufgefallen — kein Typ und kein
      // anderer Test sieht es, weil ein String ein String bleibt.
      // `describeError()` selbst ist die eine erlaubte Stelle — es muss den
      // Rohfehler ja auspacken. Ausgenommen wird deshalb genau diese Funktion,
      // nicht ihre ganze Datei: sonst verlöre `tauri.ts` auch die Literalprüfung.
      if (
        !inDescribeError(node) &&
        ts.isConditionalExpression(node) &&
        /instanceof\s+Error/.test(node.condition.getText(sf)) &&
        /\.message/.test(node.whenTrue.getText(sf)) &&
        /^String\(/.test(node.whenFalse.getText(sf))
      ) {
        add(node, 'raw-error', 'Backend-Fehler roh angezeigt — describeError() benutzen')
      }

      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return findings
}

// Direkt aufrufbar: `node scripts/check-i18n.mjs`
if (process.argv[1]?.endsWith('check-i18n.mjs')) {
  const found = scanForUntranslated()
  for (const f of found) console.log(`${f.file}:${f.line} [${f.kind}] ${f.text}`)
  console.log(`\n${found.length} Fundstelle(n).`)
  process.exit(found.length ? 1 : 0)
}
