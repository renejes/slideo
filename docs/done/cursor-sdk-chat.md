# In-App-Cursor-Chat (Cursor SDK)

**Status:** Gebaut (Host, Rust-Sidecar, ChatPanel, Settings → Cursor, „In Chat einfügen"). Login/Senden nur in der Desktop-App; GUI-Turn ausstehend.
**Stand:** 2026-08-28 · SDK `@cursor/sdk` ^1.0.28 · MCP **37 Tools**
**Vorbild:** Penwright (`vswrite-desktop`) — gleicher Funktionsumfang, anderer Host (Tauri statt Electron).

---

## Was es ist

Im Editor liegt ein Chat-Fenster (unter der Editor-Spalte, Vorschau volle Höhe). Die nutzende Person meldet sich mit ihrem **Cursor-Konto** an und spricht den Agenten direkt in Slideo an — ohne Cursor-IDE und ohne Claude Desktop. Schreiben ans Deck läuft weiter **nur über MCP** (`slideo mcp` inline); die Live-Aktualisierung bleibt die bestehende `mcp-bridge`.

Abrechnung: Cursor-Abo der Person, nicht Slideo. Ohne Login bleibt die App ein WYSIWYG-Editor; der externe MCP-Weg (Claude Desktop / Codex / …) bleibt parallel.

## Architektur

`@cursor/sdk` ist Node-only (native Helper). Deshalb **kein SDK im WebView und keins in Rust**.

```
React ChatPanel  --Tauri invoke-->  chat.rs  --JSON-RPC stdin/stdout-->  Node host.mjs  --@cursor/sdk-->  Cursor
                                         |                                      |
                                         | emit chat:event                      | MCP stdio: SLIDEO_EXE mcp
                                         v                                      v
                                    Store/chat.ts                          ipc.rs → tools.rs → AppState
                                                                              → mcp:presentation → mcp-bridge
```

| Schicht | Ort | Rolle |
|---|---|---|
| UI | [ChatPanel.tsx](../../src/components/chat/ChatPanel.tsx), [store/chat.ts](../../src/store/chat.ts) | Turns, Stream, Sessions, Login |
| Shared (kein SDK-Import) | [src/lib/chat/](../../src/lib/chat/) | Types, Stream-Merge, Allowlist, Sessions |
| Sidecar | [src-agent/](../../src-agent/) → `npm run agent:build` → `src-tauri/agent-host/host.mjs` (gitignored) | `Agent.create` / `send` / `resume` |
| Rust | [chat.rs](../../src-tauri/src/chat.rs) | Spawn Node, RPC-Proxy, Event `chat:event` |

**Allowlist** ([chatAgentOptions.ts](../../src/lib/chat/chatAgentOptions.ts)): `tools: ['mcp','read','grep','glob','ls']`, `disallowedTools: ['shell','task']`. Kein `settingSources: ['user']` — sonst würde `~/.cursor/mcp.json` ein zweites Slideo-MCP laden.

**Auth:** `Cursor.auth.login()` → 90-Tage-Key in `<config>/slideo/cursor-sdk/auth.json` (`FileCredentialStore`). Transcripts unter `<config>/slideo/chat/<deck-key>/`. Ungespeichertes Deck: Key `untitled`, cwd `<config>/slideo/workspace`.

**MCP-Kind:** `SLIDEO_EXE` + `['mcp']`; Pfade mit Leerzeichen via `quoteStdioCommand` (`bash -c exec`). Vor jedem Send: `flushMcpSync()`, damit der Socket den frischen Store sieht.

## UI

- Chat unter dem Editor ([EditorShell.tsx](../../src/components/ui/EditorShell.tsx)), Panel bleibt gemountet (`hidden` wenn zu). Höhe + Sichtbarkeit persistiert ([layout.ts](../../src/store/layout.ts) v3).
- Topbar-Icon, Shortcut **Cmd/Ctrl+J**.
- Settings → **Cursor**: Anmelden/Abmelden, Ablauf, Disclaimer.
- @-Mentions auf Folien-UUIDs; Dateianhänge; Agent/Plan; Modell/Fast/Thinking.
- Rechtsklick auf markierten Editor-Text (Tiptap + HTML) → Composer-Chip ([insertAnchor.ts](../../src/lib/chat/insertAnchor.ts)).
- Browser-`npm run dev`: Hinweis „nur Desktop-App".

## Bewusste Abweichung von Spec §13.3

Spec: keine Anthropic/OpenAI/Ollama-Calls, einzige AI-Schnittstelle = MCP. **Gilt weiter fürs Schreiben.** Der In-App-Agent ist ein zweiter *Einstieg* in genau denselben MCP-Server, nicht ein paralleler Schreibkanal. Frontend importiert `@cursor/sdk` nicht.

## Grenzen / Offen

- Node **≥ 22.13** auf dem PATH von `tauri:dev` (sonst `error.chat.nodeMissing`). Packaged App: Node muss auffindbar sein (`SLIDEO_NODE` oder übliche Pfade) — wie Penwrights offener packaged Spike.
- Login/Senden **GUI-prüfen** in `npm run tauri:dev` (Browser kann den Host nicht spawnen).
- Native SDK-Helper (`@cursor/sdk-darwin-*`) kommen als optionalDependency mit `npm install`.

## Verifikation (2026-08-28)

- `tsc --noEmit`, Vitest **103**, `vite build`, `cargo check` / `cargo test` **54** (+1 ignoriert).
- Browser: Chat-Panel + Desktop-Hinweis nach „Neue Präsentation". Live-Turn ausstehend.
