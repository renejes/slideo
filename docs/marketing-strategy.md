# Slideo — Marketing-Konzept & Positionierung

> Erarbeitet aus (a) einem Feature-Inventar direkt aus dem Code und (b) einer 6-spurigen Web-Recherche
> zum Markt (Stand 2025–2026). Ehrlich gehalten: reale, ausgelieferte Fähigkeiten getrennt von
> Aspiration; Marktzahlen mit Konfidenz und Quelle. Maßgeblich fürs Produkt bleibt
> [slideo-spec.md](slideo-spec.md) und [../CLAUDE.md](../CLAUDE.md).

---

## 0. TL;DR — die Kernthese in fünf Sätzen

1. **Nicht** gegen Gamma auf „Prompt → fertiges Deck in 30 s" antreten — die Kategorie ist besetzt
   (Gamma: ~$100M ARR, $2,1 Mrd. Bewertung, Gratis-Tier als Preisboden) und wird von Canva (260M MAU)
   und Microsoft 365 Copilot totgebündelt.
2. Stattdessen eine **angrenzende Kategorie besetzen**: *das local-first, bring-your-own-AI
   Presentation Studio.* Frame = **Eigentum & Kontrolle**, nicht Generierungs-Tempo.
3. Die **drei meistdokumentierten Schwächen** jedes Cloud-Wettbewerbers — Cloud-Lock-in/Privatsphäre,
   Credit-Metering, schwache Editier-Kontrolle über KI-Output — sind Slideos **eingebaute Stärken**.
4. Positionierung in einem Satz: **„Gamma vermietet dir eine KI in seiner Cloud; Slideo lässt dich
   Folien mit der KI bauen, die du ohnehin schon bezahlst — auf deinem Rechner, deine Dateien verlassen
   ihn nie."** (Das ist der *Obsidian-zu-Notion*-Zug, angewandt auf Decks.)
5. Erste Zielgruppe: **KI-affine Berater & Boutique-Studios**, die ohnehin Claude/ChatGPT nutzen,
   viele vertrauliche Client-Decks bauen und sauberen PowerPoint-Export brauchen — für sie fällt die
   einzige echte Hürde („du musst schon einen MCP-Client besitzen") komplett weg.

---

## 1. Was steckt drin — Feature-Inventar (aus dem Code, ehrlich)

Slideo ist eine **local-first Desktop-App (Tauri, Mac/Windows)**. Der Mensch verbindet **seine eigene KI**
(jeder MCP-kompatible Client) und die KI baut das Deck über einen **lokalen MCP-Server mit 37 Tools**; der
Mensch **editiert dann über den KI-Entwurf drüber**. Offline-first, kein AI-Layer, keine Cloud, keine
Telemetrie.

### 1.1 KI-Authoring-Fläche (MCP) — der Kern-Differenzierer

- **Bring-your-own-AI über MCP.** Kein eingebautes Modell. Eine Binary, zwei Modi (`slideo` App +
  `slideo mcp` stdio-Server). Registriert sich beim Start bei **genau einem** von drei Zielen
  (Claude Desktop · Meta-MCP-Aggregator · Claude Code) und deregistriert die anderen zwei.
- **37 verifizierte MCP-Tools** über: Deck-/Zonen-Lebenszyklus · Content (**Markdown-first** +
  HTML-Escape-Hatch) · Token-„Brand Kit" · Zonen-Layout/CSS · **17 token-gestylte Komponenten** ·
  Speaker-Notes · Builds/Transitions/Logo/Fonts/Titel · **nicht-lineare Navigation** (TOC + `data-slideo-goto`) ·
  Präsentations-Steuerung (`set_active_slide`) · **zwei read-only Layout-Prüf-Tools**
  (`check_zone_overflow`/`validate_deck`).
- **Der Server bringt der KI das Format bei** (`server_instructions` + `slideo_guide`): festes
  1280×720, Safe-Area, Markdown-Disziplin, Token-Zwang, wann Komponente vs. HTML.
- **Ehrliche Grenze:** die KI schreibt Text/Struktur/Design, aber **lädt keine Binär-Assets hoch**
  (referenziert nur vom Menschen importierte), **exportiert keine Dateien**, und der Overflow-Checker
  ist eine **reine Rust-Heuristik** (kein echtes Rendering).

### 1.2 Menschliche Editier-Ebene — „so verfeinert der Mensch den KI-Entwurf"

- **Direktmanipulation in der Live-Vorschau (§20):** Element im gerenderten Bild anklicken → Sprung
  zur Quelle im HTML-Editor; **auswählen/verschieben/duplizieren/löschen/Inline-Text/Größe/verlinken**,
  mit **Freeze-Layout-Engine** (ein Kasten verschieben lässt die Folie nicht kollabieren).
- **Brand Kit** (Token-Design-System, 11 Tokens): ein Bulk-Change **re-skinnt das ganze Deck**;
  Custom-Fonts + Logo-Upload; **Live-WCAG-Kontrastprüfung**.
- **Komponenten-Palette** (dieselben 17 Rust-Komponenten wie die KI — keine Template-Divergenz),
  Bild-Positionierung/Crop/Alt-Text, Drag&Drop-Medienimport, Asset-Manager, **Versionshistorie**
  (Auto + manuell, gekappt 50), **Undo über die Iframe-Grenze** (50 tief), Deck-weites Find&Replace,
  2-spaltige Editor-Shell.
- **Ehrliche Lücken (für Reviewer sichtbar):** **kein Redo** (nur Undo); Find&Replace ist
  case-sensitiv/literal/replace-all-only; „Spellcheck" = nur das Browser-Attribut; Überlauf wird
  **geclippt**, nicht auto-verkleinert; die reichsten §20-Ops laufen **nur auf HTML-Zonen**.

### 1.3 Präsentation, Export & Distribution

- **Presenter-Modus + integrierte Speaker-View** (Timer, nächste Folie, Notizen — kein zweiter Monitor
  nötig), **ein vereinheitlichtes Teilen-/Projektor-Fenster** (Zoom/Meet-Window-Capture *und* Beamer,
  Notizen privat), **Folien-Übersicht/Sprung-Grid**, **Laser/Stift-Overlay**, **Auto-Advance/Kiosk-Loop**.
- **Transitions inkl. Auto-Animate/FLIP-Morph**; **nicht-lineare Navigation** (Slide-Links/TOC).
- **Vier self-contained Outputs:** teilbares **Standalone-HTML** (alle Assets inline, läuft offline in
  jedem Browser) · **PDF** · **nativ rekonstruiertes, in PowerPoint editierbares PPTX** (pptxgenjs,
  keine Rasterung) · Print.
- **Struktureller Datenschutz:** keine Cloud-Calls, strikte Slide-Iframe-CSP (`connect-src 'none'`),
  token-authentifizierter lokaler IPC-Socket, `cargo audit` 0 Vulns. **`.slideo` = git-freundliche,
  diffbare lokale Datei.**
- **Bewusst weggelassen:** Aufnahme/Narration/Voiceover, Video-Export, eingebaute KI/Cloud,
  Hosted-/Link-Sharing, Kollaboration/Multiplayer.

---

## 2. Marktlage (2025–2026, mit Konfidenz & Quelle)

### 2.1 Der Platzhirsch: Gamma

- **~$100M ARR** (von $24M in 2024), **~70M Nutzer**, **600k+ zahlende**, profitabel, **$68M Series B**
  (a16z-geführt) bei **$2,1 Mrd. Bewertung**, Nov 2025 — auf ~50 Mitarbeitern (~$2M ARR/Kopf). *(hoch;
  Zahlen firmen-/gründer-berichtet)* — [TechCrunch, 10.11.2025](https://techcrunch.com/2025/11/10/ai-powerpoint-killer-gamma-hits-2-1b-valuation-100m-arr-founder-says/)
- Verspricht: **„das Blank-Page-Problem lösen"** — Prompt/Outline/Datei → volles Deck in ~30–60 s.
- KI = **eigene Orchestrierung von 20+ Modellen** (OpenAI + Anthropic gemischt) + „Agent" (3.0). **Kein
  BYO-AI**, kein lokaler Modus.
- **Gut dokumentierte Schwächen** (= Slideos Thesenkarte): (1) **cloud-only** (Privacy/Lock-in);
  (2) **kaputte PPTX/Google-Slides-Exporte** (Karten- statt Folien-Modell); (3) **wenig tiefe
  Editier-Kontrolle**, keine Animation; (4) **schwache Markenkontrolle** + wiedererkennbarer
  „Gamma-Look" (Template-Einheitsbrei); (5) **Wasserzeichen** auf Free/Plus; (6) **verwirrendes
  Credit-Modell**, Trustpilot ~1,9/5 (Billing/Support). — [eesel Reviews](https://www.eesel.ai/blog/gamma-reviews)

### 2.2 Die Incumbents (die eigentliche Distributions-Bedrohung)

| Anbieter | KI-Ansatz | Pricing | Schwäche ggü. Slideo |
|---|---|---|---|
| **Microsoft 365 Copilot** (PowerPoint) | Prompt→Deck, „Agent Mode" (Jan 2026), Brand-Kit; teils Anthropic-Modelle | **$30/User/Mo** auf M365-Lizenz (SMB Dez 2025 auf ~$21–25 gesenkt) | Cloud/Tenant-Bindung, M365-Lock-in, generischer Output |
| **Google Slides + Gemini** | Nativ editierbare Deck-Generierung (Okt 2025) | Gemini in Workspace gebündelt, Basispreise ~+$2/User/Mo | In Tests **Letzter** — „generisch & uninspiriert", eine-Folie-nach-der-anderen |
| **Canva** (Magic Design) | Generierung auf riesiger Template-Bibliothek | Pro **$15/Mo** (2025 erhöht, explizit wg. AI), 500 Credits/Mo | Template-Sameness; **trainiert KI standardmäßig auf Nutzer-Content** (Opt-out; März-2025-Kontroverse) |

Distribution ist der strukturelle Gegenwind: **Canva 260M MAU / $42 Mrd.**, **Copilot 20M+ bezahlte Seats /
90 %+ Fortune 500**. *(mittel; Aggregator-Quellen)*

Der **anbieterübergreifende Hauptkritikpunkt**: generischer, template-gebundener Output + ein
**„hier ist eine Version, jetzt reparier sie"**-Workflow — direkte Marktvalidierung für Slideos
„KI baut den Entwurf, Mensch editiert drüber". — [XDA-Test](https://www.xda-developers.com/created-presentation-claude-design-copilot-powerpoint-one-professional/), [Plus AI](https://plusai.com/blog/microsoft-copilot-vs-google-gemini/)

### 2.3 Herausforderer & Lehrstücke

- **Tome — eingestellt (30.04.2025).** 20M Nutzer, aber **<$4M ARR**; Pivot zu Sales-Tooling (Lightfield).
  **Lehre: zu wenig Kontrolle über KI-Output → Nutzer zahlen nicht.** — [Deckary](https://deckary.com/blog/tome-review)
- **Beautiful.ai — „zu starr/einheitlich".** Constraint-basierte „smart slides" erzwingen Politur,
  produzieren Einheitsbrei; **$12 Pro / $40+ Team pro Seat** (10er-Team ≈ $4.800/Jahr). — [getalai](https://getalai.com/blog/beautiful-ai-alternative)
- **Pitch — fast kollabiert** (Jan 2024: ~78 % Stellen gestrichen, 180→~40, CEO-Wechsel, VC
  zurückgegeben), Pivot zu Sales-Enablement, ~$10M ARR 2025. — [TechCrunch](https://techcrunch.com/2024/01/08/pitch-christian-reber-venture-funding/)
- **Überlebensstrategien der Übrigen:** *in Incumbents einbetten* (Plus AI, SlidesAI — Add-ons für
  Slides/PowerPoint) oder *Vertikale besetzen* (Slidebean = Pitch-Decks; Genially = interaktiv/eLearning,
  30M Nutzer; Decktopus = SMB; Chronicle = „story-first", $7,5M, PPTX-Export erst Ende 2025).

**Quer-Lehre für Slideo:** (1) zu starr = churnender Einheitsbrei; (2) zu wenig Kontrolle = eingestellt;
(3) Standalone-Generierung monetarisiert schlecht → Pivot zu Sales oder Einbettung. **Slideos
Differenzierer treffen genau diese Lücken.**

### 2.4 Zwei Rückenwind-Trends (Slideos Keil)

- **MCP ist Standard geworden.** Anthropic, OpenAI (ChatGPT, Agents SDK, Responses API), Google, Microsoft;
  nativ in VS Code/Copilot, Cursor, Windsurf, Zed, JetBrains, Cline, Goose, Codex CLI. **Dez 2025 an eine
  Linux-Foundation-„Agentic AI Foundation" gespendet.** Registry wächst schnell (+407 % in 2 Monaten).
  *(hoch)* — [Anthropic](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
  ⚠️ Server-Zahlen (10.000+/97M Downloads) sind sekundär — als *direktional* behandeln.
- **Local-first / Privacy monetarisiert nachweislich.** Obsidian (1M+ Nutzer, bootstrapped, kein VC,
  lokale Dateien, zahlt via optionalem Sync/Publish + Commercial-Lizenz) ist das Vorbild. **53 % der
  IT-Leader** nennen Datenschutz die #1-Hürde für KI-Agenten. *(hoch/mittel)* — [Obsidian](https://obsidian.md/pricing), [Kiteworks/Cloudera](https://www.kiteworks.com/cybersecurity-risk-management/ai-agents-enterprise-data-privacy-security-balance/)
- **Belastbarster Beleg für „KI-Entwurf braucht menschliche Nachbearbeitung":** die **HBS/BCG
  „Jagged Frontier"-Studie** (758 Berater) — innerhalb der KI-Grenze hebt KI Qualität, außerhalb
  verschlechtert sie sie. *(hoch, peer-reviewed)* — [SSRN 4573321](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321)

### 2.5 Pricing-Landschaft

- Dominant: **Freemium + KI-Credit-Metering** + Per-Seat für Teams. **Credit-Metering ist das
  meistgehasste Pricing-Muster 2025–26** (Cursor-Backlash + CEO-Entschuldigung Juni 2025; Salesforce
  3 Modelle in <1 Jahr). — [softwarepricing.com](https://softwarepricing.com/blog/usage-based-pricing-backfire-field-guide/)
- **Gegen-Strömung „Eigentum":** Affinity komplett gratis (Canva, Okt 2025); Obsidian kommerziell gratis
  (Feb 2025, monetarisiert optionale Services); **TablePlus/Sketch = „renewable license"** (einmalig
  ~$79–99 + ~12 Monate Updates, danach ewig nutzen oder verlängern).
- **Für Slideo relevant:** Es hostet **keine KI** → **kein** Per-Generierungs-Kostenpunkt → jedes
  Credit-Metering wäre **reine künstliche Reibung**.

---

## 3. Positionierung

**Kategorie (bewusst neu geschaffen, off-axis):** *Local-first, bring-your-own-AI Presentation Studio.*
Nicht als billigeres/schnelleres Gamma, sondern als **prinzipielle Alternative** für Leute, die
vertrauliche Decks nicht in eine Anbieter-Cloud legen wollen.

**One-Liner:**
> *Slideo is a local-first desktop presentation studio you drive with the AI you already pay for — the
> private, own-your-files alternative to cloud AI deck makers like Gamma.*

**Elevator Pitch:**
> *Every AI deck tool today locks you into its cloud and its AI, meters you by credits, and hands back a
> generic, hard-to-edit draft you can't get out of cleanly. Slideo flips all of that: a desktop app that
> runs offline with no built-in AI and no telemetry. You connect the AI you already use — Claude Desktop,
> Claude Code, Codex CLI, or any MCP client — and it authors the whole deck by calling a local server with
> 37 tools; then you edit over the draft directly in the live preview: click any element, move it, rewrite
> it, re-theme the whole deck to your brand in one change. Your deck is a plain local file that exports to
> genuinely editable PowerPoint. Your AI, your slides, your machine — nothing phones home.*

---

## 4. Differenzierer (jeder gegen eine belegte Marktlücke)

1. **Bring your own AI via MCP** — kein Modell, keine Credits, kein Lock-in.
   *Beleg:* 37 MCP-Tools, eine Binary, kein AI-Layer. *vs. Markt:* Gamma metert eigene 20+ Modelle;
   Copilot/Canva/Gemini binden an ihren Stack. Credit-Metering ist das meistgehasste Muster — Slideo hat
   nichts zu metern.
2. **Local-first, offline, keine Telemetrie** — Datenschutz strukturell, kein Schalter.
   *Beleg:* keine Cloud-Calls, `connect-src 'none'`-CSP, token-authed IPC, `cargo audit` 0. *vs. Markt:*
   alle Incumbents cloud-only; Canva trainiert standardmäßig auf Nutzer-Content. Kein großer Wettbewerber
   führt mit local-first.
3. **KI entwirft, Mensch besitzt die Bearbeitung** — echte Direktmanipulation.
   *Beleg:* §20 klick-jedes-Element → verschieben/umschreiben/verlinken, Freeze-Layout, Cross-Iframe-Undo.
   *vs. Markt:* Tome starb an *zu wenig* Kontrolle; Gamma/Copilot für flaches Editieren kritisiert. Slideo
   macht den (durch HBS/BCG validierten) Pflicht-Editierschritt zur Kern-UX.
4. **Festes 16:9 + nativer, editierbarer PPTX-Export.**
   *Beleg:* 1280×720, pptxgenjs (echte Textboxen). *vs. Markt:* kaputter PPTX-Export ist Gammas
   meistgenannter Makel & Mit-Ursache von Tomes Tod; „Exporte, die wirklich funktionieren" ist ein
   Business-Käufer-Keil.
5. **Globales Token-„Brand Kit" schlägt Template-Sameness.**
   *Beleg:* 11 Tokens + 17 Token-Komponenten, ein Bulk-Change re-skinnt alles, Live-WCAG-Check. *vs. Markt:*
   „alle KI-Decks sehen gleich aus" ist reale 2025-Ermüdung; zentrale Marken-Konsistenz ist die
   meistgeforderte Korrektur — ohne in Beautiful.ais Starrheits-Falle zu tappen.
6. **Besitze deine Datei** — schlicht, diffbar, versionierbar.
   *Beleg:* `.slideo` = serde_json (Order erhalten) → saubere Git-Diffs; lokale Snapshots. *vs. Markt:*
   Cloud-Wettbewerber speichern proprietäre Cloud-Dokumente, geteilt über Links, die dir nicht gehören.

---

## 5. Zielgruppen (ICP)

**Primär — KI-affine Solo-Berater & Boutique-Strategie/Design-Studios (2–15 Personen).**
Zahlen schon Claude Pro/Max oder ChatGPT (oft Claude Desktop/Code im Einsatz), bauen viele Client-Decks,
arbeiten unter NDA. *Schmerz:* Vertrauliches darf nicht in eine Anbieter-Cloud; Cloud-KI-Decks wirken
templatig und exportieren kaputt zu PPTX; Per-Seat/Credit-Pricing sticht bei kleinen Shops. *Warum Slideo:*
Sie besitzen die KI schon → BYO-AI ist Feature, keine Hürde; local-first erfüllt NDAs; Direktmanipulation +
Brand Kit bringen Decks on-brand; PPTX exportiert sauber. **Schärfster Keil.**

**Sekundär — Privacy/IP-sensible & regulierte Teams** (Legal, Finance, Healthcare, Deep-Tech/Defense-nah).
Board-Decks/Deal-Material dürfen rechtlich/kompetitiv nicht in Dritt-Clouds; Misstrauen ggü.
KI-Training-Defaults. *Warum Slideo:* offline, keine Telemetrie, Dateien lokal, einziger KI-Touchpoint ist
der eigene, freigegebene MCP-Client — eine Story, die kein Cloud-Incumbent erzählen kann. Höherer ARPU.

**Tertiär — Entwickler & technische Gründer in Claude Code / Cursor.** Wollen Decks (Investor-Updates,
Architektur-Reviews) aus demselben agentischen Tool, als diffbare Dateien. *Warum Slideo:* Null-Reibung
(ihr Agent treibt Slideos MCP-Server), `.slideo` git-freundlich, Markdown-first passt ins Mental-Modell.
**Natürliche Build-in-Public-Verstärker** fürs ganze Produkt.

---

## 6. Messaging-Säulen

| Säule | Botschaft | Beleg |
|---|---|---|
| **Your AI, not ours** | Bring die KI, die du schon bezahlst — Claude, ChatGPT, jeder MCP-Client. Kein Modell, keine Credits, kein Lock-in. | 37-Tool-MCP-Server; eine Binary; kein AI-Layer |
| **Stays on your machine** | Offline by design. Keine Cloud, keine Telemetrie, kein Training auf deinem Content. Decks sind Dateien, die dir gehören. | `connect-src 'none'`, token-authed IPC, lokale `.slideo` + lokale History, `cargo audit` 0 |
| **AI drafts it, you own the edit** | Die KI baut den Entwurf; du verfeinerst direkt — klick jedes Element in der Live-Vorschau. | §20 Direktmanipulation + Freeze-Layout, Cross-Iframe-Undo, Markdown-first |
| **On-brand, never templated** | Ein Brand-Kit-Change re-skinnt das ganze Deck. Raus aus „alle KI-Decks sehen gleich aus". | 11 Tokens + 17 Komponenten, Custom-Fonts/Logo, Live-WCAG-Check |
| **Exports that actually work** | Festes 16:9, das in *echt editierbares* PowerPoint, PDF und ein self-contained Offline-HTML rekonstruiert. | 1280×720, natives pptxgenjs-PPTX, Standalone-HTML mit Inline-Assets |

**Tagline-Kandidaten:**
- „Your AI. Your slides. Your machine."
- „Bring your own AI. Keep your own files."
- „AI builds it. You own it."
- „The presentation tool that never phones home."
- „Rent nothing. Own your deck."

---

## 7. Pricing-Hypothese

**Nicht** Gammas Freemium+Credit-Metering kopieren (Slideo hostet keine KI → jedes Metering ist künstliche
Reibung + meistgehasstes Muster). Best-Fit = **Prosumer-Eigentums-Modell**, das zur local-first-Marke passt:

1. **Gratis Personal-Tier ohne Feature-Gates** — tötet die Blank-Page-Reibung, treibt Word-of-Mouth
   (Obsidian/Affinity-Akquise-Keil).
2. **Primär-Umsatz: einmalige Perpetual-„Pro"-Lizenz ~$99** (Range $79–129) inkl. ~12 Monate Updates,
   danach ewig nutzbar, optionale niedrige „Updates"-Verlängerung (TablePlus/Sketch „renewable license").
   Gated: kommerzielle/professionelle Nutzung, Pro-Exporte, Advanced-Features.
3. **Commercial/Team-Lizenz ~$50–99/User/Jahr** (Obsidian-Stil) für Organisationen.
4. **Einzige künftige Recurring-Einnahme** monetarisiert nur, was echt Geld kostet: optionales
   **Hosted-Deck-Sharing** oder **Team-Brand-Kit-Sync** — **nie** das lokale Editieren.

**Explizit vermeiden:** Per-Seat-Cloud-SaaS und KI-Credit-Metering. **Trade-off akzeptieren:** kein
KI-Nutzungsumsatz → Unit-Economics via Lizenz-Conversion + schlankes Team (das Gamma/Obsidian-Kapital-
Effizienz-Muster).

---

## 8. Go-to-Market

**Kanäle (nach Hebel):**
1. **MCP-Registries & -Directories** — offizielle MCP-Registry, `awesome-mcp-servers`, Anthropic-Showcase;
   One-Command-Install + Claude-Skill. *Warum:* genau dort sucht die primäre ICP; Distribution, die
   voraussetzt, dass der Nutzer die KI besitzt → BYO-AI-Hürde verschwindet.
2. **Show HN + Local-first-Community** — „local-first presentation tool you drive with your own AI".
   *Warum:* die local-first/own-your-data-These hat ein technisches Publikum, das prinzipielle, offline,
   no-VC-cloud Tools belohnt.
3. **Vergleichs-/problem-first-SEO** — „Local, private alternative to Gamma", „AI decks that export to
   PowerPoint correctly", „Bring your own AI presentation tool", „Why AI decks all look the same".
   *Warum:* fängt dokumentierten, hoch-intentionalen Wettbewerber-Schmerz ab.
4. **Design-Partner / Founder-led** — 10–20 Berater/Boutiquen/regulierte Teams; Before/After-Client-Deck-
   Cases; Build-in-Public auf X/LinkedIn.
5. **Anthropic/Claude-Co-Marketing** — Platzierung als Featured-MCP-Integration; Flagship-Demo „Build a
   client deck with Claude, keep it 100 % local".
6. **Privacy/Compliance-Vertikalen** — Legal-Tech/Fintech/Healthcare-Ops mit Data-Residency-Botschaft +
   Security-One-Pager (CSP, keine Telemetrie, lokale Dateien, Audit).

**90-Tage-Startplan (verdichtet):**
- **W1–3:** Launch-Blocker räumen — **alle KI-Texte auf Englisch lokalisieren**; macOS+Windows
  **signieren & notarisieren**; §20/§21/§23 end-to-end **GUI-verifizieren** und Claims festzurren.
- **W2–4:** „Du hast schon Claude"-Onboarding perfektionieren (Ein-Modal-Setup, Copy-Paste-Prompt,
  erstes Deck < 2 min).
- **W3–5:** Pricing finalisieren (Gratis-Tier ohne Gates + ~$99 Einmal-Pro-Lizenz + Commercial); keine
  Credits, kein Per-Seat-SaaS.
- **W4–6:** Private Design-Partner-Beta (10–20 primäre ICP + einige regulierte Kontakte); 2–3
  Before/After-Cases.
- **W5–7:** Distributions-Fläche publizieren (MCP-Registry, awesome-mcp-servers, Anthropic-Showcase,
  Claude-Skill, Security-One-Pager).
- **W6–8:** Problem-first-Content ausliefern (je an einen belegten Wettbewerber-Schmerz verankert).
- **W8–10:** Public Launch — Show HN, Flagship-Demo-Video, Build-in-Public-Thread; local-first-/Privacy-
  Communities.
- **W10–13:** Konvertieren & lernen — Design-Partner-Stories → Homepage-Social-Proof; Claude/Anthropic-
  Co-Marketing; regulierte/vertikale Ansprache mit Commercial-Lizenz; Top-Post-Launch-Lücke priorisieren
  (wahrscheinlich Redo, Find&Replace-Tiefe oder Hosted-Sharing).

---

## 9. Ehrliche Schwächen & Risiken ( nicht schönreden )

**Schwächen, die vor/beim Launch adressiert werden müssen:**
- ✅ **KI-Texte auf Englisch lokalisiert (2026-07-15, erledigt).** Die gesamte AI-facing MCP-Oberfläche —
  `server_instructions`, `slideo_guide`, alle 37 Tool-/Parameter-Beschreibungen, `list_components`/
  `list_presets`-Katalog + Komponenten-Platzhalter, Overflow-Hinweise und alle an die KI zurückgegebenen
  Fehlermeldungen (tools/mcp/ipc/overflow) — ist jetzt Englisch (Prompt-Argument `thema`→`topic`). Deutsche
  **Dev-Kommentare** und die **deutsche Frontend-UI** bleiben unangetastet; geteilte Datei-I/O-Fehler bleiben
  deutsch (primär Frontend-sichtbar). cargo test 42/42 grün. *(Damit ist dieser Release-Blocker aus dem
  90-Tage-Plan W1–3 erledigt; die App-Chrome-UI selbst bleibt für einen späteren Schritt deutsch.)*
- 🔴 **Noch kein vertrauenswürdiger Download** — Code-Signing, Notarization, Cross-Platform-Release-Builds
  offen ([next-steps.md](next-steps.md) Abschnitt C). Kein echter Launch möglich, bis das steht.
- 🟠 **Flagship-Flächen (§20/§21/§23) im Code ausgeliefert, aber GUI-Verifikation ausstehend** — Marketing-
  Claims dazu bis zur End-to-End-Verifikation hedgen.
- 🟠 **BYO-AI ist ein zweischneidiger Keil** — null KI-Nutzungsumsatz **und** setzt voraus, dass der Nutzer
  schon ein Claude/ChatGPT/MCP-Abo besitzt. Nische-first (Prosumer/Privacy), kein Massenmarkt.
- 🟡 Kein Redo (nur 50-tiefes Undo); Find&Replace nur case-sensitiv/literal/replace-all; „Spellcheck" nur
  Browser-Attribut; Überlauf geclippt (kein Auto-Fit).
- 🟡 Reichste §20-Ops nur auf HTML-Zonen; Markdown-Zonen bekommen gröbere Block-Ops.
- 🟡 PPTX ist native Text+Bild-Rekonstruktion, nicht pixelgenau (HTML-Zonen zu Text vereinfacht).
- 🟡 Kein Hosted-/Link-Sharing (Teilen = Datei übergeben); keine Kollaboration/Multiplayer — verliert
  Team-Deals an Pitch/Canva/Google out of the gate.

**Strategische Risiken & Mitigation:**
- *Incumbent-Bündelung + Gammas Gratis-Tier commoditisieren Generierung.* → **Nie** auf Tempo/Preis-pro-
  Generierung konkurrieren; nur auf den Achsen, die sie strukturell nicht kopieren können (Privacy,
  Own-your-files, BYO-AI, tiefe Editier-Kontrolle). Gratis-Tier hält den Preisboden irrelevant.
- *BYO-AI-Adoptions-Hürde.* → Primäre ICP anvisieren (die die Hürde schon genommen hat); Setup als
  gefeierten Ein-Modal-Flow; in MCP-Registries + Claudes Ökosystem verteilen.
- *MCP könnte fragmentieren.* → Client-agnostisch bleiben (drei-Ziel-Design hedged); Basis-Risiko niedrig
  (Linux-Foundation, alle vier Großen aligned).
- *Tome/Beautiful.ai-Failure-Modes (zu wenig Kontrolle / zu starr).* → Slideo fädelt beides: Design-System
  **und** Direktmanipulation — explizit beide Botschaften fahren („on-brand, never templated" + „you own
  the edit").
- *Standalone-Generierung monetarisiert historisch schlecht.* → Eigentum + Commercial-Lizenz monetarisieren
  (Obsidian/TablePlus), lean laufen, an eine verteidigbare Nische ankern (Privacy/reguliert + Berater).

---

## 10. Synthese: das eine Bild

> Der Markt beweist die Nachfrage (Gamma), die Incumbents beweisen die Distributions-Falle, und die
> Lehrstücke (Tome, Beautiful.ai, Pitch) beweisen die zwei Todesarten. Slideos gesamte Existenzberechtigung
> ist, **zwischen ihnen durchzufädeln** und auf einer Achse zu spielen, die die Großen aus
> Geschäftsmodell-Gründen **nicht kopieren können**: *deine KI, deine Folien, dein Rechner.* Das ist kein
> Massenmarkt — aber es ist ein verteidigbarer, vertrauensgetriebener, monetarisierbarer Keil, für den
> Obsidian das Vorbild ist.

*Quellen: siehe Inline-Links; vollständige Recherche-Rohdaten + Konfidenzen im Workflow-Output. Zahlen von
Anbietern sind firmen-berichtet und entsprechend markiert.*
