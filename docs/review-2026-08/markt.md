> **Methode & Lesehilfe.** Synthese aus sechs Rechercheschienen (KI-native Generatoren · Inkumbenten-Suiten · Code-first/Markdown-Tools · agentische MCP-Landschaft · UX-Erwartungen & Usability-Evidenz · Geschäftsmodell/Distribution). Konfidenz inline: **[H]** = mehrere unabhängige oder primäre Quellen (Herstellerdoku, Release Notes, Spec, GitHub-API) · **[M]** = eine solide Quelle oder Sekundärberichterstattung · **[N]** = Anbieter-Blog, SEO-Content oder unbestätigt — solche Zahlen sind als *Richtung*, nie als Fakt zu lesen.
> Slideo-Aussagen sind entweder **im Repo verifiziert** (grep/Datei-Check, so markiert), **aus den Tracks belegt** oder ausdrücklich **unbekannt**. Es wird nichts über Slideo geraten.

---

## 1. Marktkarte nach Ebenen

### Überblick

| Ebene | Wettbewerbsdichte | Wer dominiert | Slideos Position | Verdikt |
|---|---|---|---|---|
| **Generierung** | extrem, kommodifiziert | Gamma, Copilot, Gemini, Canva, Claude/ChatGPT-Add-ins | nimmt nicht teil (kein AI-Layer), bezieht die Ebene vom Client des Nutzers | ökonomisch stark, narrativ wertlos |
| **Nachbearbeitung / Editing** | niedrig bei KI-nativen, hoch bei Inkumbenten | PowerPoint, Figma Slides, Canva | **der Keil** — Direktmanipulation über dem KI-Entwurf | vorne im Konzept, hinten in der Mechanik |
| **Design-System / Marke** | 2026 von „Feature" zu Table Stakes gekippt | MS Brand Kit + Brand Reviewer, Canva, Presentations.ai | Token-Vertrag ist konzeptionell stark, aber ohne Ingest und ohne Checker | Parität mit Lücken an beiden Enden |
| **Präsentation / Delivery** | dünn bei KI-nativen, tief bei Inkumbenten | PowerPoint, Keynote, Prezi | über Parität mit dem gesamten KI-nativen Feld, unter PowerPoint/Keynote | unterverkaufte Stärke |
| **Export / Interop** | hoch — und die Ebene mit der lautesten Beschwerde | Plus AI (nativ by construction), Presentations.ai, Presenton | architektonisch richtig, in Details unvollständig, **kein Import** | strategisch entscheidend |
| **Kollaboration** | sehr hoch, strukturell unerreichbar | Google Slides, Figma, Canva, Pitch, Keynote | draußen (bewusst) | nicht jagen, sondern beantworten |
| **Plattform-Bündelung** | extrem | Microsoft, Google, Canva, Apple, Anthropic | kann nicht mitspielen | Verteidigung = explizit nicht-Enterprise |
| **Infrastruktur / Protokoll (MCP)** | 2026 von exotisch zu besetzt | Gamma, Google, Microsoft, Slidev, Anthropic-Connectors | **Tiefe statt Präsenz** — aber veralteter Installationspfad | Positionierung muss sich verschieben |

---

### 1.1 Generierung (Prompt → Rohentwurf)

**Wer:** Gamma (~$100M ARR, $2,1 Mrd. Bewertung, Nov 2025, unternehmenseigene Angabe [M] — [businesswire](https://www.businesswire.com/news/home/20251110805751/en/Gamma-Surpasses-$100M-ARR-Raises-at-$2.1B-Valuation-as-It-Replaces-PowerPoint-for-the-AI-Era)), Copilot Agent Mode, Gemini in Slides, Canva AI 2.0, Presentations.ai, Decktopus, Chronicle, Beautiful.ai, Presenton, dutzende python-pptx-MCP-Server, Anthropics eigene `pptx`-Skill, Claude Design, ChatGPT Agent Mode.

**Härte: maximal.** Alle vier Inkumbenten liefern seit Mitte 2026 Ein-Prompt-Volldecks als **nativ editierbare** Folien, nicht als Bilder [H]. Gleichzeitig ist die Qualität überall gedeckelt: PresentBench (Tsinghua, arXiv 2603.07244, März 2026) bewertet „Visual Design & Layout" als die **schlechteste Dimension über alle Systeme hinweg**, bester Wert 62,8/100 [H] — [arxiv.org](https://arxiv.org/html/2603.07244v1).

**Slideo:** nimmt strukturell nicht teil. Der Entwurf kommt aus dem bezahlten Frontier-Modell des Nutzers. Das ist ökonomisch der beste Platz im Markt (null Grenzkosten, keine Credits), aber als *Verkaufsargument* tot: „Deine KI baut das Deck" sagen 2026 alle.

---

### 1.2 Nachbearbeitung / Editing (der Entwurf ist da — jetzt korrigieren)

**Wer:** PowerPoint (On-Canvas-Rewrite: Textbox markieren → Stift → Auto-rewrite/Condense/Make professional/Visualize as list, Rollout Mär–Apr 2026 [H] — [support.microsoft.com](https://support.microsoft.com/en-us/powerpoint/edit-with-copilot-in-powerpoint)), Figma Slides, Canva, Plus AI (Remix/Rewrite *im* Host-Tool), Gamma Agent, Chronicle Muse.

**Härte: das eigentliche Schlachtfeld — und die Ebene, an der der Markt sichtbar scheitert.**
- Workday/Hanover (Nov 2025, n=3.200): ~40 % der KI-Produktivitätsgewinne gehen für Nacharbeit drauf [M] — [hrdive.com](https://www.hrdive.com/news/ai-output-reduced-rework-low-quality-workday/810075/).
- Ein Produktionsteam berichtet, ~12 % der KI-generierten Folien seien strukturell kaputt (Out-of-bounds, Überlappung), bis ein 46-Regeln-Geometrie-Linter das auf <1 % drückte [N, Anbieter-Blog] — [slideforge.dev](https://slideforge.dev/blog/python-pptx-limitations-we-solved).
- Jeder 2026er Vergleichstest endet mit derselben Feststellung: kein Tool liefert ohne menschliche Nachbearbeitung aus.
- Die beiden Versagenspole sind bekannt: **Beautiful.ai zu starr** (Nutzer können Elemente nicht frei setzen, „passen die Botschaft ans Template an"), **Tome zu wenig Kontrolle** (eingestellt).

**Slideo:** §20-Direktmanipulation (Element in der Live-Vorschau anklicken → verschieben/inline editieren/duplizieren/löschen/verlinken, undoable) plus Block-Direktmanipulation für Markdown. **Kein KI-nativer Wettbewerber versucht das**, weil deren Geschäftsmodell auf einer bewusst beschnittenen Leinwand beruht — Gamma deckelt Pixel-Kontrolle ausdrücklich. Der einzige vergleichbare Mechanismus ist Slidevs `v-drag`, dessen eigene Doku zugibt, dass die Positions-Rückschreibung per Regex auf dem Markdown unzuverlässig ist [H] — [sli.dev](https://sli.dev/features/draggable).

**Aber:** genau auf dieser Ebene fehlen die langweiligen Grundlagen (Redo, Folie duplizieren, Mehrfachauswahl, Thumbnail-Leiste, Sections, Autosave — alle im Repo verifiziert nicht vorhanden). Der Keil ist scharf, der Griff ist unfertig.

---

### 1.3 Design-System / Marke

**Wer:** Microsoft Brand Kit (Farben, Fonts, Logos, Icons, `.potx`, **Brand Voice**) GA ~Mai–Jul 2026 mit eigenem Brand-Pane in PowerPoint und **Brand Reviewer**, der ein Deck gegen das Kit lintet [H] — [support.microsoft.com](https://support.microsoft.com/en-us/powerpoint/copilot/keep-your-presentation-on-brand-with-copilot), [mc.merill.net/message/MC1405505](https://mc.merill.net/message/MC1405505). Dazu Canva Brand Intelligence, Presentations.ai Brand Sync, Google Theme Builder, Posits portables `_brand.yml` (Quarto + Shiny) [H] — [quarto.org](https://quarto.org/docs/authoring/brand.html).

**Härte: 2026 zu Table Stakes geworden.** Ein Brand Kit ist kein Feature mehr, sondern Hygiene. Neu und noch nicht Standard sind drei Dinge: **Ingest** (Marke aus URL/Deck/Guidelines-PDF ziehen), **Voice** (Tonalität als Teil des Kits) und **Compliance-Check**.

**Slideo:** 11 Design-Tokens + Logo + Font-Upload, mit einem Vorteil, den die Inkumbenten nicht haben: die Tokens sind **für Mensch und KI gleichermaßen schreibbar** und sind ein *harter Vertrag* — Komponenten dürfen ausschließlich `var(--color-*)`/`var(--font-*)` emittieren. Das ist eine echte strukturelle Antwort auf die „AI-Slop/alle Decks sehen gleich aus"-Kritik, keine Marketingbehauptung. Lücken: kein Ingest, kein Checker (nichts scannt `zone.html`/`custom_css` auf hartkodierte Hex-Farben — genau der Fehlermodus, vor dem die eigenen Konventionen warnen), 5 Presets + 4 Starter-Templates gegen Gammas Theme-Bibliothek.

---

### 1.4 Präsentation / Delivery

**Wer:** PowerPoint (Presenter View, Speaker Coach, **Cameo** = Live-Kamera als Folienobjekt, Live-Untertitel mit Übersetzung, Recording Studio), Keynote (Magic Move, PiP mit Hintergrundentfernung, 100 gleichzeitige Bearbeiter gratis), Prezi Video, Canva (Magic Shortcuts, Handy-Fernbedienung, Talking Presentations).

**Härte: bei den KI-nativen sehr niedrig.** Gamma hat Presenter View + Notizen + Timer + Spotlight — und lieferte **erst im Juni 2026** die Schriftgrößen-Zoomstufe im Presenter View nach [H] — [meetgamma.canny.io/changelog](https://meetgamma.canny.io/changelog). Die meisten Rivalen haben deutlich weniger.

**Slideo:** gestapelte SpeakerView (aktuelle Folie · Timer · nächste · Notizen), Folienübersicht/Sprung-Grid, Laser/Stift, Auto-Advance/Loop, `auto`-FLIP-Morph über `data-id` (der Keynote-Magic-Move/PowerPoint-Morph-Referenzpunkt), und ein vereinheitlichtes Projektor-Fenster, das entweder dekoriert-teilbar (Zoom/Meet) oder randlos-Vollbild (Beamer) ist — **auf echter Multi-Display-Hardware GUI-bestätigt**. Das ist **an oder über Parität mit Figma Slides und über dem gesamten KI-nativen Feld**, und es ist derzeit unterverkauft.

Fehlend gegenüber den Inkumbenten: Live-Untertitel, Kamera auf der Folie, Handy-Fernbedienung, Deck-zu-Video, Speaker Coach. Selbstverschuldete v1-Grenze: **Laser/Stift sind im Zwei-Fenster-Modus deaktiviert** — also genau dann, wenn ein Vortragender sie braucht.

---

### 1.5 Export / Interop

**Wer:** Plus AI (löst das Problem, indem es die Leinwand nie besitzt), Presentations.ai und Presenton (editierbares PPTX als Kernpositionierung), Marp (`--pdf-notes`, `--pdf-outlines`, `--pptx-editable`), Gamma (schlecht).

**Härte: hoch, und dies ist die Ebene mit der lautesten Beschwerde im ganzen Markt.** PPTX-Export-Bruch ist über alle unabhängigen 2026er Reviews hinweg die #1-Klage: Font-Substitution auf Calibri/Arial, vertikal verschobener Text, nicht-16:9-Maße, **komplett entfernte Animationen** — Ursache: scrollende Web-„Karten" bilden sich nicht auf feste Folien ab [H]. Eine Reddit-Auswertung nennt PPTX-Qualität in ~38 % der Gamma-Threads [N, Anbieter-Analyse, nicht primärverlinkt].

**Slideo:** native Rekonstruktion via pptxgenjs (echte Textboxen, Bilder, Token-Hintergründe, in PowerPoint editierbar), **ohne externe Abhängigkeiten** — das schlägt Slidev (bild-basiert, Text nicht markierbar [H], [sli.dev/guide/exporting](https://sli.dev/guide/exporting)) und Marp (`--pptx-editable` braucht Browser **und** installiertes LibreOffice Impress, dokumentiert niedrigere Treue, **keine Sprechernotizen** [H]).

**Zwei harte Lücken:** (a) keine Sprechernotizen im PPTX, keine PDF-Notizseiten, kein PDF-Outline — *im Repo verifiziert*; (b) **kein PPTX-Import**, also kein Weg von einem vorhandenen Corporate-Template. Die „Template-Steuer" (das eigene Master aufgeben zu müssen) wird in 2026er Reviews als Hauptgrund genannt, warum Nutzer zu PowerPoint zurückkehren [M] — [llemental.com](https://llemental.com/posts/best-ai-for-powerpoint-presentations-template-preservation).

---

### 1.6 Kollaboration

**Wer:** Google Slides (Referenzimplementierung), Figma Slides, Canva (Kommentare auch im Free-Tarif), Pitch (Co-Presenting mit Übergabe, Rollen, Teamspaces), Keynote (100 gleichzeitige Bearbeiter, gratis).

**Härte: sehr hoch — und für eine Backend-lose lokale App strukturell unerreichbar.** Echtzeit-Koediting, Kommentare, Rollen und Viewer-Analytics sind auf jedem bezahlten Cloud-Tarif Table Stakes.

**Slideo:** draußen, korrekterweise. Zwei ehrliche Substitute existieren und sollten benannt statt verschwiegen werden: (1) die selbst-enthaltene Standalone-HTML-Datei zum Selbst-Hosten; (2) ein Kollaborationsmodell, das sonst niemand hat — **Mensch und KI-Agent bearbeiten dasselbe Deck live und bidirektional**. Der billige Teil-Konter gegen die Kommentar-Kritik wäre asynchrones Review (Review-Notiz pro Zone), nicht Multiplayer.

---

### 1.7 Plattform-Bündelung

**Wer:** Microsoft (Copilot Agent Mode **GA und Default** in Word/Excel/PowerPoint seit 22.04.2026), Google (Gemini in die Workspace-Basistarife eingepreist), Canva (~260M monatliche Nutzer, ~$4 Mrd. ARR Ende 2025 — unternehmenseigen [M]), Apple (iWork freemium seit 28.01.2026), **Anthropic selbst** (Claude in PowerPoint, Claude Design × Canva).

**Härte: extrem — und das ist die eigentliche Langfristbedrohung, nicht die Startups.** Für jeden Firmennutzer eliminieren diese Angebote den Export-Schritt vollständig und kosten nichts extra.

**Slideo:** kann auf dieser Ebene nicht mitspielen. Der verteidigbare Boden ist ausdrücklich **nicht-Enterprise**: kein Microsoft-Konto, keine Cloud, keine Seat-Lizenz, eine gestaltete eigene Bühne statt eines Corporate-Templates, volle Kontrolle über die Datei. Gegendatenpunkt zur Cloud-Seite: TechCrunch berichtete am 18.02.2026 über einen Office-Bug, der vertrauliche Kunden-E-Mails gegenüber Copilot offenlegte [H] — [techcrunch.com](https://techcrunch.com/2026/02/18/microsoft-says-office-bug-exposed-customers-confidential-emails-to-copilot-ai/); das EU-Parlament sperrte eingebaute KI auf Arbeitsgeräten.

---

### 1.8 Infrastruktur / Protokoll (MCP)

**Wer — und das ist die wichtigste Veränderung des Jahres:**
- **Gamma** betreibt einen offiziellen Remote-MCP-Server (`https://mcp.gamma.app/mcp`, OAuth, nutzbar aus Claude Code/Codex/Cursor/VS Code) plus Claude-Connector (23.01.2026) und ChatGPT-App (06.03.2026) [H] — [developers.gamma.app/reference/changelog](https://developers.gamma.app/reference/changelog).
- **Google** veröffentlichte einen offiziellen Remote-Slides-MCP-Server (Developer Preview, 13.07.2026) mit **zwei** groben Tools: `read_presentation` / `update_presentation` [H] — [developers.google.com](https://developers.google.com/workspace/slides/api/guides/configure-mcp-server).
- **Microsoft** machte MCP-Agenten ab 15.07.2026 in Word/Excel/PowerPoint im Web erreichbar [H] — [learn.microsoft.com](https://learn.microsoft.com/en-us/microsoft-365/copilot/release-notes).
- **Slidev** liefert seit v52.17.0 (10.07.2026) einen **eingebauten MCP-Server** mit derselben Zwei-Modi-Architektur wie Slideo (HTTP `/__mcp` am Dev-Server + `slidev mcp` stdio), 8 Tools inkl. Live-`goto-slide` [H] — [sli.dev/features/mcp](https://sli.dev/features/mcp).
- **Anthropic** legitimierte das Muster „KI steuert meine laufende lokale App" mit **Claude for Creative Work** (28.04.2026): neun MCP-Connectors in Blender, Adobe CC, Affinity, Ableton, Fusion, SketchUp, Splice, Resolume — Affinity zeigt es als eigenen Settings-Schalter „Enable Affinity MCP" [H] — [anthropic.com](https://www.anthropic.com/news/claude-for-creative-work). **Kein Präsentationsprogramm ist dabei.**
- Das Protokoll selbst wurde am 09.12.2025 an die Linux Foundation / Agentic AI Foundation übergeben; Spec-Revision 28.07.2026 (stateless, Multi Round-Trip Requests statt Elicitation, Sampling/Roots/Logging deprecated) [H] — [blog.modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-07-28/).

**Slideo:** die Differenzierung ist **nicht mehr „hat MCP"**, sondern **MCP-Tiefe**: 37 semantische Tools (Tokens, Presets, 17 Komponenten, Reveal-Schritte, Transitions, Logo/Fonts, Layout-Validierung) gegen Googles 2 rohe API-Tools und Slidevs 8 Quelltext-Tools — in eine **laufende GUI-App mit autoritativem State und bidirektionaler Sync**, ohne OAuth, ohne Cloud-Projekt, ohne Node.

**Die Schwäche liegt nicht in der Architektur, sondern in der Distribution:** 2026 installiert man einen lokalen MCP-Server per `.mcpb`-Doppelklick oder aus dem Connectors-Verzeichnis; Slideo schreibt stattdessen `claude_desktop_config.json` / `~/.claude.json` direkt.

---

## 2. Table-Stakes-Checkliste 2026

Legende **Slideo:** ✅ vorhanden · ⚠️ teilweise · ❌ fehlt · ❔ unbekannt (Recherche schweigt).
„(Repo)" = direkt im Quellcode verifiziert. „TS" = Table Stakes 2026 (✅ = erwartet, ⬆️ = im Aufkommen, ❌ = Nische/Differenzierer).

### Editor-Mechanik

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| Undo | alle | ✅ | ✅ |
| **Redo (Cmd+Shift+Z)** | alle ausnahmslos | ✅ | ❌ — `grep redo src/` = 0 Treffer (Repo) |
| **Folie duplizieren (Cmd+D)** | PPT, Keynote, Slides, Canva, Beautiful.ai, Figma | ✅ | ❌ — nur `duplicateZoneBlock` auf Block-Ebene, keine `duplicateZone` (Repo) |
| Folien kopieren/einfügen, auch deckübergreifend | PPT, Keynote, Slides, Canva | ✅ | ❌ |
| Mehrfachauswahl von Folien + Bulk-Operationen | PPT-Foliensortierung, Keynote, Slides, Canva | ✅ | ❌ |
| Persistente Thumbnail-Leiste / Sorter im Editor | alle | ✅ | ❌ im Editor (bewusst entfernt); Grid existiert nur im Präsentationsmodus |
| **Sections / Gruppen** | PPT (seit 2010), Figma Slides (2026) | ✅ | ❌ — kein `section` im Datenmodell (Repo) |
| **Autosave + Crash-Recovery** | PPT (AutoRecover), Slides, Canva (alle paar Sek.), Keynote, Figma | ✅ | ❌ — manuelles Speichern + CloseGuard (Repo) |
| Versionshistorie mit Restore | Slides (40 benannte), Canva (Pro, 30 Tage), M365, Figma | ✅ | ✅ — lokale `.slideo`-Snapshots, unbegrenzt, offline, kostenlos |
| Tastaturkürzel-Dichte | PPT: 50–80 publizierte Kürzel | ✅ | ❌ — 4 globale (Cmd+S/N/F/Z) (Repo) |
| Suchen & Ersetzen | alle | ✅ | ✅ |

### Layout & Qualität

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| **Auto-fit / Shrink-on-overflow** | PPT-Platzhalter (Default!), Deckset `autoscale`, Slidev `<AutoFitText>`, reveal `.r-fit-text` | ✅ | ❌ — feste 1280×720 mit `overflow:hidden` = stilles Clipping |
| Overflow-Warnung im Menschen-UI | Marp for VS Code (`slide-content-overflow`, v3.3.0, opt-in, misst echtes `scrollHeight`), Touying `detect-overflow` | ⬆️ | ❌ — keine Referenz auf die Prüfung in `src/components` (Repo) |
| **Overflow-Prüfung für die KI** | Slideo; ansatzweise GongRzhe (text fit checking) | ❌ selten | ✅ `check_zone_overflow`/`validate_deck` — aber reine Rust-Heuristik ohne echtes Rendering |
| Auto-Paginate bei Überlauf | Touying `breakable:true` (PR ausdrücklich `feat(agents)` betitelt) | ❌ | ❌ |
| Snapping / Ausrichtungshilfen bei freier Positionierung | PPT Smart Guides, Keynote, Canva, Figma | ✅ (wo frei positioniert wird) | ❌ für den §20-Drag |
| Barrierefreiheits-Check | PPT Accessibility Checker, Quarto 1.8 (axe-core) | ✅ (regulatorisch) | ⚠️ — Alt-Text + WCAG-Kontrast vorhanden, kein konsolidiertes Panel |

### Marke & Design-System

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| Brand Kit (Farben/Fonts/Logo) | jeder bezahlte Tarif | ✅ | ✅ — 11 Tokens + Logo + Font-Upload, KI-schreibbar |
| **Brand-Ingest aus URL / Deck / Guidelines-PDF** | Presentations.ai Brand Sync, Gemini „Match presentation style", MS (aus Guidelines-Doc, 15.07.2026), Prezi (aus URL), PPT „Reuse style" | ⬆️→✅ | ❌ |
| Brand-Compliance-Checker | MS Brand Reviewer | ⬆️ | ❌ |
| Brand Voice / Tonalität im Kit | MS Brand Kit, Canva | ❌ | ❔ |
| Vorlagen-/Theme-Tiefe | Gamma-Bibliothek, 2Slides 1.500+ Master-Slides [N], Canva, Beautiful.ai | ✅ | ⚠️ dünn — 5 Presets + 4 Starter-Templates |
| Hell/Dunkel-Varianten eines Themes | Quarto 1.8 (`brand-mode: dark`), Marp core v4.2, Slidev | ⬆️ | ❌ |
| Portables Brand-Format (`_brand.yml`) | Quarto (revealjs + typst), Shiny | ❌ | ❌ |

### Inhalt

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| **KI kann Bilder erzeugen / einfügen** | Gamma (8+ Modelle), PPT (MAI-Image-2-Efficient, FLUX.2 Flex), Canva, Presenton (DALL-E 3/Gemini/ComfyUI/Pexels), Keynote (Abo) | ✅ | ❌ — MCP-Oberfläche verweigert Binär-Upload by design; KI kann nur bereits importierte Assets referenzieren |
| Stock-/Icon-Bibliothek | Canva (100M+), PPT, Keynote Content Hub | ✅ | ⚠️ — 17 Token-Komponenten + Material Symbols, keine Bildbibliothek |
| Diagramme aus Text (Mermaid) | Slidev (eigener Renderer seit v52.14.1), Quarto, Marp-Plugins | ✅ im Dev-Segment | ❌ |
| Charts aus Daten | PPT (Excel-verknüpft), Slides (Sheets-verknüpft), Canva, Beautiful.ai | ✅ | ⚠️ — bar/line/donut + `data_table` + `big_number` als Komponenten, aber keine nachträglich editierbaren Daten, keine Datenbindung |
| Live-Daten-Refresh (QBR/Board-Decks) | Presentations.ai (Salesforce/HubSpot/Sheets/Tableau), Plus AI Live Snapshots | ❌ | ❌ |
| Folien-Nummern / Fußzeilen / Datum | PPT, Keynote, Slides, LibreOffice | ✅ | ❌ |

### Delivery

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| Presenter View (aktuell + nächste + Notizen + Timer) | alle | ✅ | ✅ — gestapelte SpeakerView |
| Folienübersicht / Sprung-Grid | alle Inkumbenten; bei KI-nativen selten | ✅ | ✅ |
| Laser / Stift-Annotation | PPT, Keynote, Slidev (Drauu), reveal (chalkboard, Zeichnungen als JSON speicherbar) | ✅ | ⚠️ vorhanden, **im Zwei-Fenster-Modus deaktiviert**; nicht persistiert |
| Auto-Advance / Kiosk-Loop | PPT, Keynote | ⬆️ | ✅ |
| Zweitbildschirm + teilbares Fenster (Zoom/Meet) | PPT/Keynote nativ; Web-Tools über Browser-Vollbild | ✅ | ✅ — vereinheitlichtes `projector`-Fenster (GUI-bestätigt) |
| Übergänge / Builds / Objekt-Morph | PPT Morph, Keynote Magic Move, reveal Auto-Animate | ✅ | ✅ — `auto`-FLIP über `data-id`, **übersteht den Standalone-Export** |
| Notizen an Build-Schritte gekoppelt | Slidev (`[click]`-Marker heben den passenden Notiz-Abschnitt hervor) | ❌ | ❌ — beide Hälften existieren (`zone.reveal` + Notizen), sind aber nicht verbunden |
| Publikum folgt auf eigenem Gerät | Quarto/reveal multiplex, Slidev `--remote --tunnel` | ❌ | ❌ (bewusst — bräuchte Relay-Server) |
| Live-Untertitel (+ Übersetzung) | PPT (mit Übersetzung), Google Slides | ✅ | ❌ |
| Kamera auf der Folie (Cameo / PiP) | PPT Cameo, Keynote PiP mit Hintergrundentfernung | ✅ | ❌ |
| Speaker Coach / Proben-Feedback | nur PowerPoint; Decktopus „Loop" (Q&A-Simulation) | ❌ | ❌ |
| Deck-zu-Video-Aufzeichnung | Canva Talking Presentations, PPT Recording Studio, Keynote | ✅ bei Consumer-Inkumbenten | ❌ (bewusst out of scope, §19.8) |
| Mobile App / Handy als Fernbedienung | alle vier Inkumbenten (Canva legt Magic Shortcuts auf die Fernbedienung) | ✅ | ❌ |
| Zeitbudget / Pacing-Feedback | Deckset (`time-budget: 20`) | ❌ | ❌ |
| Pause-/Break-Screen mit Inhalt | Deckset (`pause-screen-image/text`) | ❌ | ❔ |

### Export & Interop

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| **Nativ editierbares PPTX (Text markierbar)** | Presentations.ai, Plus AI (by construction), Presenton, Pitch, Decktopus; Marp nur experimentell + LibreOffice-Pflicht; Slidev bild-basiert; Gamma schlecht | ✅ | ✅ **stärkster verifizierbarer Vorsprung** — pptxgenjs-Rekonstruktion ohne externe Abhängigkeit |
| Sprechernotizen im PPTX | Slidev; Marp *nicht* bei `--pptx-editable` | ⬆️ | ❌ — keine Notizen-Behandlung in `src/lib/pptx.ts` (Repo) |
| PDF mit Notizseiten / PDF-Outline | Marp (`--pdf-notes`, `--pdf-outlines`), PPT (Handzettel), Canva | ⬆️ | ❌ — PDF läuft über `open_print_view` → Browser-Druck (Repo) |
| Notizen als reiner Text exportieren | Marp `--notes`, Slidev `/overview` | ❌ | ❔ |
| **PPTX-Import (Corporate-Template übernehmen)** | alle vier Inkumbenten, LibreOffice/ONLYOFFICE | ✅ | ❌ — kein Importpfad in `src/` oder `src-tauri/src/` (Repo) |
| Selbst-enthaltener Offline-HTML-Export | praktisch niemand | ❌ | ✅ — lädt aber bewusst externe Ressourcen (Slidevs „Bundle Remote Assets" wäre der Fix) |
| Share-Link + Viewer-/Folien-Analytics | Gamma (Karten-Ebene, Juli 2026), Pitch, Presentations.ai, Decktopus, Chronicle | ✅ | ❌ (strukturell) |

### Kollaboration

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| Echtzeit-Koediting | Slides, Figma, Canva, Pitch, Keynote (100 gleichzeitig, gratis) | ✅ | ❌ (bewusst) |
| Kommentare / @Mentions | alle, teils im Free-Tarif | ✅ | ❌ |
| Rollen & Berechtigungen | Pitch, Canva, M365 | ✅ | ❌ |
| Mensch + KI-Agent gleichzeitig am selben Live-Deck | **nur Slideo** | ❌ | ✅ |

### KI-Kanal

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| KI editiert eine bestehende Folie granular | Gamma Agent, Chronicle Muse, Plus AI Remix, Copilot, Decktopus | ✅ | ✅ — 37 Tools auf Zonen-/Block-/Element-Ebene, live, ohne Credits |
| **Outline-/Plan-Freigabe vor der Generierung** | Gemini in Slides (klärende Rückfragen → editierbarer Plan → „Approve"), Copilot (Execution Plan), Beautiful.ai (2026), Prezi | ✅ | ❌ |
| Sichtbare Agenten-Schrittliste am Dokument | Copilot Agent Mode (Sidebar hakt Schritte ab), Prezi | ✅ | ❌ |
| Änderungs-Highlighting auf dem Artefakt | Prezi (direkt auf den Folien); Codex-CLI-Diff | ⬆️ | ❌ |
| Undo einer ganzen KI-Runde | Copilot, Claude Code `/rewind`, Prezi „Chat rewind" | ⬆️ | ❌ — Undo existiert, aber pro Mutation |
| **KI sieht das gerenderte Ergebnis (Screenshot-Tool)** | tszaks/keynote-mcp (`keynote_get_design_snapshot`) | ❌ | ❌ |
| **Ein-Klick-Installation (`.mcpb`)** | Anthropic MCPB, Affinity-In-App-Schalter, Connectors-Verzeichnis | ✅ im MCP-Kanal | ❌ — schreibt Client-Configs direkt |
| Tool-Annotationen (`readOnlyHint`/`destructiveHint`) | Pflicht für das Anthropic Connectors Directory | ✅ | ❌ — nicht in `tool_schemas` emittiert; die Semantik existiert aber bereits (`is_read_only_tool`, tools.rs:133) (Repo) |
| Portables Agent Skill (SKILL.md) | Slidev (`npx skills add slidevjs/slidev`), Anthropic-Doc-Skills, keynote-mcp | ⬆️ | ⚠️ — Skill existiert (§18.7), keine öffentliche Distribution belegt |
| Interaktive UI im KI-Client (MCP Apps, `ui://`) | SEP-1865 seit 26.01.2026: Claude, Goose, VS Code Insiders, ChatGPT | ❌ | ❌ |
| Multi-Client über Claude hinaus | Slidev (MCP + Skills + VS Code LM Tools), Unity MCP (Cursor/Windsurf/Codex/Copilot) | ✅ | ⚠️ — 3 Registrierungsziele (Claude Desktop / Claude Code / Meta-MCP) |

### Auslieferung & Geschäftsmodell

| Feature | Wer hat es | TS | Slideo |
|---|---|---|---|
| **Signierter + notarisierter macOS-Build** | jede kommerzielle Mac-App | ✅ | ❌ — keine `signingIdentity`, keine Notarisierung in `tauri.conf.json` (Repo) |
| Signierter Windows-Build | alle | ✅ | ❌ |
| **In-App-Auto-Update** | TablePlus, Sketch, Raycast, Zed, Screen Studio, Sublime | ✅ | ❌ — kein `tauri-plugin-updater`, Version 0.1.0 (Repo) |
| Schriftliche Update-Politik auf der Preisseite | TablePlus (1 J. + $59/Gerät), Sublime (3 J.), Sketch (1 J.), JetBrains (Fallback-Lizenz) | ✅ | ⚠️ — „unbefristet" dokumentiert, Update-Fenster nicht |
| **Englische UI** | ausnahmslos alle Vergleichsprodukte | ✅ | ❌ — 67 von 68 `.ts/.tsx` mit deutschen Strings, keine i18n-Lib (Repo) |
| Homebrew Cask | Standard für Dev-nahe Mac-Tools | ✅ im ICP | ❌ |
| Offline-Aktivierung, kein Hard-Lock bei Netzausfall | Standard bei Perpetual-Software | ✅ | ✅ |
| Geräteverwaltung / Seat-Freigabe | TablePlus (1–2 Geräte), Screen Studio (3) | ✅ | ✅ — 3 Aktivierungen + Freigabe, **großzügiger als TablePlus** |
| Merchant of Record (EU-USt, Widerrufsrecht) | Polar, Paddle, Lemon Squeezy, Gumroad, Setapp | ✅ für DE-Verkäufer | ✅ — Polar |

---

## 3. Was der Markt besser macht

Sortiert nach Häufigkeit über die sechs Schienen hinweg. In Klammern: in wie vielen Tracks der Punkt unabhängig auftaucht.

### Stufe 1 — von mehreren Schienen als größte Lücke benannt

1. **Auto-fit statt stillem Clipping (3/6).** Deckset (`autoscale`, global + pro Folie), Slidev (`<AutoFitText :max :min>`, fitty, Default-Untergrenze 30 px), reveal.js (`.r-fit-text`), Marp (horizontal), Beautiful.ai (adaptive Smart Slides). **PowerPoints Platzhalter-Default ist „Shrink text on overflow"** — Nutzer sind darauf trainiert, dass Text *schrumpft*, nie dass er verschwindet [H]. Slideos `overflow:hidden` verletzt eine antrainierte Erwartung. Zwei getrennte Varianten sind Standard: Body-Shrink mit **explizitem Font-Minimum** und „Headline so groß wie möglich".
2. **Gemessene Overflow-Warnung, nicht geschätzte (3/6).** Marp for VS Code misst den echten gerenderten Preview (`scrollHeight > clientHeight`) gegen die **Safe Area** und meldet es als Editor-Diagnose — bewusst **opt-in**, weil die Warnung sonst als aufdringlich empfunden wird [H] — [github.com/marp-team/marp-vscode/issues/519](https://github.com/marp-team/marp-vscode/issues/519). Touying warnt zur Compile-Zeit. Slideos Prüfung ist eine reine Rust-Schätzung *und* nur über MCP sichtbar (im Repo verifiziert: keine Referenz in `src/components`). Ironie: Slideo hat als einziger bereits ein Live-Iframe-Rendering jeder Folie, könnte also am billigsten die Wahrheit messen.
3. **Die KI kann Bilder liefern (2/6 — beide nennen es „größte konkrete Lücke").** Gamma: 8+ Bildmodelle. PowerPoint: MAI-Image-2-Efficient (01.07.2026), FLUX.2 Flex (16.06./15.07.2026). Presenton: DALL-E 3, Gemini Flash, ComfyUI, Pexels, Pixabay. Ein KI-verfasstes Slideo-Deck ist heute **nur Text und Vektor**. Der Pfad, der die „keine Binärdaten über MCP"-Haltung nicht verletzt: ein Tool, das einen **lokalen Dateipfad** annimmt.
4. **Marke aus vorhandenem Material ziehen (4/6).** Presentations.ai Brand Sync (aus URL), Gemini „Match presentation style" (aus einem Deck), Microsoft (aus einem Guidelines-Dokument, 15.07.2026), Prezi (aus URL), Posit `_brand.yml` (portables Format). Slideo hat ein exzellentes **Ziel** (11 Tokens) und keine **Zufahrt** — bei nur 11 zu füllenden Werten ist das ungewöhnlich gut lösbar, notfalls rein als dokumentiertes Prompt-Muster.
5. **Outline-/Plan-Freigabe vor der Generierung (3/6).** Gemini in Slides stellt klärende Rückfragen, zeigt Übersicht + Quellen + Folien-Outline und lässt bestätigen, *bevor* gebaut wird [H] — [support.google.com/docs/answer/17111393](https://support.google.com/docs/answer/17111393). Das verwandelt eine Ein-Schuss-Wette in einen steuerbaren Prozess und ist das am billigsten kopierbare Muster des Jahres (Instruktions-Ebene, kein Code).
6. **Installations- und Auffindbarkeitspfad im KI-Kanal (3/6).** `.mcpb`-Doppelklick, Connectors-Verzeichnis, offizielle MCP-Registry (`mcpb`-Pakettyp zeigt auf ein GitHub-Release mit Pflicht-`fileSha256`), portable SKILL.md. `marp-mcp` bündelt ein Claude-Code-Skill, sodass `/marp` **ganz ohne MCP-Konfiguration** funktioniert — niedrigere Friktion als Slideos Setup-Modal.
7. **Vorlagen-/Theme-Tiefe (3/6).** 5 Presets + 4 Starter-Templates gegen Theme-Bibliotheken. Da Presets reine Daten sind (in `presets.ts`/`presets.rs` gespiegelt, kein Schema-Eingriff), ist die Ausweitung auf ~20 art-direktierte Sets der billigste verfügbare Konter gegen die „alle KI-Decks sehen gleich aus"-Kritik.

### Stufe 2 — zwei Schienen, oder eine Schiene plus Repo-Verifikation

8. **Editor-Grundmechanik (systematisch nur in Schiene 5 erhoben, aber im Repo verifiziert):** kein Redo, kein Folie-duplizieren, kein Kopieren/Einfügen, keine Mehrfachauswahl, keine Thumbnail-Leiste im Editor, keine Sections, vier Tastaturkürzel. Jedes einzelne davon ist universell vorhanden. Fehlendes Redo ist in einer KI-Authoring-App doppelt schmerzhaft, weil der Nutzer laufend KI-Änderungen zurücknimmt und wiederholen will.
9. **Autosave + Crash-Recovery (2/6).** PowerPoint (AutoRecover + Recovery-Panel), Slides, Canva (alle paar Sekunden), Keynote, Figma. Nutzer haben Cmd+S verlernt. Slideo hat alle Bausteine (atomarer Temp+Rename-Writer, `history/`-Verzeichnis, `isDirty`).
10. **PPTX-Import / „Template-Steuer" (2/6).** Die schmale, hochwertige Variante ist nicht voller Import: Theme-Farben + Heading/Body-Fonts + Logo aus einer `.potx/.pptx` in die Tokens ziehen.
11. **Export-Vollständigkeit im Kleinen (2/6):** keine Notizen im PPTX (pptxgenjs kann `addNotes()`), keine PDF-Notizseiten, kein PDF-Outline, keine Notizen-als-Text. Vier kleine Dinge, die jeder Marp-Umsteiger am ersten Tag bemerkt.
12. **Agenten-Provenance-UI (2/6).** Copilots Sidebar hakt Schritte wie eine To-do-Liste ab; Prezi hebt Änderungen direkt auf den Folien hervor und bietet „Chat rewind". In Slideo mutieren Folien einfach. Zusätzlich: eine KI-Runde erzeugt 12 Undo-Schritte statt einem.
13. **Laser/Stift im Zwei-Fenster-Modus (2/6).** Slidevs Drauu hat eine `syncAll`-Option — das erwartete Verhalten ist Spiegelung, nicht Abschaltung.
14. **Kommentare / asynchrones Review (2/6).** Beide Schienen halten Multiplayer für zu Recht out of scope, weisen aber darauf hin, dass jeder Buyer's Guide danach bewertet und der reale Bedarf („mein Chef will Feedback hinterlassen") mit einer Review-Notiz pro Zone abgedeckt wäre.

### Stufe 3 — je eine Schiene, aber konkret und billig

15. **Die KI sieht ihr Ergebnis nicht.** `tszaks/keynote-mcp` exportiert Folien-PNGs, damit Claude visuell analysieren kann. Slideo rendert bereits offscreen 1280×720 (`renderSingleZonePage`).
16. **Auto-Paginate** (Touying `breakable`, PR-Titel `feat(agents)` — weil Agenten zu viel Inhalt produzieren).
17. **Mermaid** — Table Stakes im Dev-Segment und eine exzellente KI-Oberfläche, weil LLMs Mermaid fließend schreiben.
18. **Mobile/Handy-Fernbedienung, Kamera auf der Folie, Live-Untertitel, Deck-zu-Video** — alle vier Inkumbenten haben sie; für eine lokale App teils machbar (LAN-Remote), teils bewusst zu verwerfen.
19. **Kleinkram mit Signalwirkung:** Foliennummern/Fußzeilen, Snapping auf die Safe-Area-Kanten beim §20-Drag, Zeitbudget, Pause-Screen, Notizen an Build-Schritte gekoppelt, Hell/Dunkel-Varianten, `_brand.yml`-Import/Export.
20. **Live-Daten-Decks** (Presentations.ai-Konnektoren, Plus AI Live Snapshots) — teilweise on-thesis über den MCP-Stack des Nutzers lösbar, aber nur wenn ausdrücklich gelehrt.

---

## 4. Wo Slideo strukturell vorne ist

Nur Behauptungen, die die Recherche trägt. In Klammern die Anzahl unabhängiger Schienen.

1. **Die Korrekturschicht über dem KI-Entwurf (4/6) — der eigentliche Keil.** Jeder 2026er Vergleichstest endet mit „kein Tool liefert ohne menschliche Nachbearbeitung"; Gamma deckelt Pixel-Kontrolle ausdrücklich zugunsten von Konsistenz; Beautiful.ais Starrheit ist seine meistgenannte Schwäche; Claude Design (Anthropics eigenes) hat berichtet **keinen verlässlichen Weg, Folien darin zu bearbeiten** [M]. Kein KI-nativer Wettbewerber versucht diese Ebene, weil die beschnittene Leinwand geschäftsmodell-tragend ist.
2. **MCP-Tiefe statt MCP-Präsenz (4/6).** 37 domänengeformte Tools mit echtem Vokabular (Tokens, Presets, 17 Komponenten, Reveal-Schritte, Transitions, Layout-Validierung) gegen Googles **zwei** rohe API-Tools und Slidevs **acht** Quelltext-Tools. Ein Agent an Slidev schreibt Text und hofft; ein Agent an Slideo bedient ein Designsystem und kann fragen, ob die Folie passt. Dazu: **null Setup-Friktion** (kein GCP-Projekt, kein OAuth-Consent-Screen, keine vier Scopes, kein bezahlter Connector-Tarif — ein lokaler Socket mit generiertem Shared Secret und 0600-Config).
3. **Live-bidirektionale Autorenschaft in einer laufenden App (3/6).** Copilot Agent Mode und Gemini sind chat-first/batch: Prompt → Datei → öffnen. Hosted MCP-Endpoints (2Slides, SlideSpeak, Alai, Gamma) sind fire-and-forget: du bekommst eine Datei zurück. Die einzigen anderen Dinge, die eine laufende lokale Deck-App steuern, sind Hobbyprojekte (Keynote via AppleScript/JXA, Windows-only COM-Server) und Slidevs Dev-Server (Node + Vite + Vue). Die Kombination „lokale GUI + Vorschau + Agent + Mensch gleichzeitig" ist leer.
4. **Ein Layout-Orakel für das Modell (3/6, mit Einschränkung).** `check_zone_overflow`/`validate_deck` gegen eine feste 1280×720-Bühne mit gelehrter Safe Area ist ein Muster, das fast niemand dem Modell exponiert — und die 2026er Diskussion sagt übereinstimmend, dass **Validatoren, nicht bessere Prompts**, Generierung verlässlich machen. **Einschränkung, die genannt werden muss:** Schiene 3 kritisiert dieselbe Funktion als schwächste Ausprägung im Feld, weil sie nie ein echtes Rendering misst. Vorne im *Konzept*, hinten in der *Treue*.
5. **Ökonomie (4/6).** Das gesamte KI-native Feld ist Abo + Credits (Gamma 1.000–20.000 Credits/Monat je Tarif, Chronicle nicht übertragbare Token-Eimer, Decktopus ~30 Credits pro Deck, Pitch €0,004/Extra-Credit). Credit-Erschöpfung und undurchsichtige Credit-Mathematik gehören zu den lautesten Klagen 2026. Slideo hat **keine Inferenzkosten weiterzugeben** — das macht die Einmallizenz nicht zur Preispräferenz, sondern zur strukturellen Position. Zed hat mit „unlimited use with your own API keys or external agents" bereits normalisiert, dass BYO-KI nie gemessen wird [H] — [zed.dev/pricing](https://zed.dev/pricing).
6. **Dateibesitz mit dem stärksten möglichen Beweis (3/6).** Tome stellte sein Präsentationsprodukt am **30.04.2025** ein; wer bis dahin nicht exportiert hatte, verlor die Arbeit dauerhaft — bei ~20 Mio. Nutzern. Ein `.slideo` ist ein ZIP aus reihenfolgetreuem JSON + echten Assets, git-diffbar und ohne die App lesbar. Kein Cloud-Anbieter bietet ein diffbares Deck-Format.
7. **Offline — aber das Delta ist die Botschaft, nicht das Wort (4/6).** Canva Offline kam ~Juni 2026 gratis für alle und ist damit kein Alleinstellungsmerkmal mehr — aber es verlangt Vor-Markieren eines Designs, läuft nach **14 Tagen** ab, und offline sind Bibliothek, **alle KI-Werkzeuge**, Kollaboration, Exporte und das Anlegen neuer Designs gesperrt; auf iOS/iPadOS und Firefox 149+ gar nicht [H] — [socialsamosa.com](https://www.socialsamosa.com/industry-updates/canva-launches-offline-mode-12021595). Gamma hat keinen Offline-Modus und einen offenen, ungelieferten Feature-Request dafür [H] — [meetgamma.canny.io](https://meetgamma.canny.io/ideas/p/have-an-app-that-supports-offline-editing). Slidev brauchte 2026 ein eigenes PWA-Precaching-Feature, um zu erreichen, was eine Tauri-App geschenkt bekommt. **Formulierung ab jetzt: „kein Konto, kein Sync, kein Ablaufdatum, die Datei liegt auf deiner Platte" — nicht „funktioniert offline".**
8. **Nativ editierbares PPTX ohne externe Abhängigkeit (3/6).** Slidevs PPTX ist bild-basiert (Text nicht markierbar, dokumentiert). Marps `--pptx-editable` braucht Browser **und** LibreOffice Impress, hat dokumentiert geringere Treue und **keine Sprechernotizen**. Gammas Export ist die meistgenannte Abwanderungsursache. Claim: *„in PowerPoint editierbar, ohne LibreOffice"* — und ein Seite-an-Seite-Vergleich gegen einen Gamma-Export ist der beste Beweis, den Slideo führen kann.
9. **Delivery-Stack (3/6).** An oder über Parität mit Figma Slides, deutlich über dem gesamten KI-nativen Feld — und es funktioniert ohne Internet.
10. **Motion (3/6).** Reveal-Schritte + `data-id`-FLIP-Morph, die **in den Standalone-Export überleben**. Gamma lieferte KI-Animationen erst im Januar 2026 und **entfernt beim PPTX-Export alle Animationen**.
11. **Versionshistorie ohne Cloud-Konto (2/6).** Lokale `.slideo`-Snapshots, auto beim Speichern (dedupliziert), manuell beschriftbar, Kappung schützt manuelle — unbegrenzte Aufbewahrung, offline, kostenlos, gegen Canvas 30 Tage hinter Pro und Googles 40 benannte Versionen.
12. **Determinismus als Anti-Slop-Mechanik (2/6).** Der Token-Vertrag + Token-only-Komponenten + feste Bühne + Selbstprüfungs-Orakel geben dem Modell eine harte Zusage statt einer Bitte.
13. **Komponiert mit dem gesamten MCP-Stack des Nutzers (2/6).** Copilot groundet nur auf Microsoft-Daten, Gemini nur auf Drive, Canva nur auf eigene Konnektoren. Slideos Nutzer hat Dateisystem, Git, Notion, Gmail, Browser und interne Server bereits am Client — Slideo erbt das gesamte Grounding gratis, auf privaten Daten, die keinen Anbieter berühren.
14. **Sicherheitsposition (1/6, aber gut belegt).** Token-authentifizierter Loopback-Socket, 0600-`ipc.json`, 16-MiB-Cap, strikte CSP in den Folien-Iframes, keine externen Netzressourcen in der App. Die 2026er Empfehlungen für lokale MCP-Server (Sandboxing, eingeschränkter Dateizugriff, kein unnötiger Netzzugang) sind zu Slideos Gunsten geschrieben — aber das steht in `docs/audit.md` statt auf einer Produktseite.
15. **Barrierefreiheit (3/6).** Alt-Text + WCAG-Kontrast. In Slidev, Marp, reveal.js und Deckset fand keine Schiene eine A11y-Prüfung; nur Quarto 1.8 hat eine (axe-core). Regulatorischer Rückenwind: EAA gilt seit **28.06.2025**, ADA Title II verlangt WCAG 2.1 AA bis **24.04.2026** — für ein DE/EU-Produkt ein Verkaufsargument, keine Pflichtübung.

---

## 5. Marktbewegungen 2026, die relevant sind

| Datum | Ereignis | Warum es Slideo betrifft | Quelle / Konfidenz |
|---|---|---|---|
| **30.04.2025** | Tome stellt das Präsentationsprodukt ein; nicht exportierte Arbeit dauerhaft verloren (~20 Mio. Nutzer, <$4M Umsatz) | stärkstes Argument für lokale Dateien — **und** Warnung, dass Consumer-Deck-Tools schlecht monetarisieren | [deckary.com](https://deckary.com/blog/tome-review) [M] |
| **28.06.2025** | European Accessibility Act in Kraft | A11y-Check wird Verkaufsargument im DE/EU-Markt | [levelaccess.com](https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/) [H] |
| **09.08.2025** | Marp for VS Code v3.3.0: `slide-content-overflow`-Diagnose (misst echtes Rendering gegen die Safe Area, **opt-in**) | das direkt kopierbarste UX-Muster für Slideos schwächste Stelle | [CHANGELOG](https://raw.githubusercontent.com/marp-team/marp-vscode/main/CHANGELOG.md) [H] |
| **15.09.2025** | Gamma führt Credit-Preise ein | Credit-Frust wird zur wiederkehrenden Klage → Slideos „keine Credits, nie" bekommt Kontrast | [developers.gamma.app](https://developers.gamma.app/reference/changelog) [H] |
| **30.10.2025** | **Canva macht Affinity dauerhaft kostenlos** | „Einmalkauf" allein ist kein Differenzierer mehr gegen den größten Anbieter im Nachbarmarkt | [cgchannel.com](https://www.cgchannel.com/2025/10/check-out-canvas-new-perpetually-free-affinity-software/) [M] |
| **10.11.2025** | Gamma: $100M ARR, $2,1 Mrd. Bewertung, $68M a16z | die Kategorie ist kapitalisiert und konsolidiert | [businesswire](https://www.businesswire.com/news/home/20251110805751/en/Gamma-Surpasses-$100M-ARR-Raises-at-$2.1B-Valuation-as-It-Replaces-PowerPoint-for-the-AI-Era) [M, unternehmenseigen] |
| **09.12.2025** | **MCP an die Linux Foundation / Agentic AI Foundation gespendet** (Anthropic, OpenAI, Block; AWS/Google/Microsoft als Platinum) | „BYO-KI-Client" ist eine dauerhafte Wette auf einen herstellerneutralen Standard, keine Claude-Wette | [anthropic.com](https://anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) [H] |
| **18.12.2025** | Agent Skills als offener Standard | zweiter, MCP-unabhängiger Distributionskanal entsteht | [platform.claude.com](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) [H] |
| **12.01.2026** | Claude Cowork (agentischer Desktop-Modus auf lokalen Dateien) | „meine KI baut mir eine Datei" ist bereits bezahlt und installiert | [techcrunch.com](https://techcrunch.com/2026/07/07/the-coding-agent-wars-are-spilling-into-the-rest-of-the-office-claude-cowork/) [H] |
| **23.01.2026** | **Gamma Claude Connector** (offizieller Remote-MCP-Server) | „deine KI baut das Deck über MCP" ist ab hier kein Alleinstellungsmerkmal | [mcpservers.org](https://mcpservers.org/remote-mcp-servers/gamma) [H] |
| **26.01.2026** | **MCP Apps (SEP-1865)** — erste offizielle Erweiterung: `ui://`-Ressourcen in sandboxed Iframes | Slideo könnte Folien-Thumbnails oder einen Overflow-Report *im Chat* rendern; Architektur (Iframe + postMessage) ist bereits vorhanden | [blog.modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) [H] |
| **28.01.2026** | Apple Creator Studio: iWork wird freemium ($12,99/Mon. bzw. $129/J.), Keynote-KI hinter dem Abo | Apple monetarisiert vormals Kostenloses — Goodwill-Schaden, den ein bezahltes Indie-Tool nutzen kann | [9to5mac.com](https://9to5mac.com/2026/01/28/pages-keynote-numbers-get-ios-26-updates-heres-everything-new/) [M] |
| **~05.02.2026** | Claude in PowerPoint (Research Preview), respektiert Slide Master, Layouts, Fonts, Farbschema | direkter struktureller Angriff auf Slideos Kernthese, aber im Format des Kunden | [ghacks.net](https://www.ghacks.net/2026/02/23/anthropic-launches-claude-inside-powerpoint-for-ai-powered-slide-creation-and-editing/) [M — Datum aus Sekundärquelle] |
| **18.02.2026** | Microsoft meldet Office-Bug, der vertrauliche Kunden-E-Mails gegenüber Copilot offenlegte | belegtes, nicht theoretisches Argument für lokale Datenhaltung | [techcrunch.com](https://techcrunch.com/2026/02/18/microsoft-says-office-bug-exposed-customers-confidential-emails-to-copilot-ai/) [H] |
| **03.2026** | **PresentBench** (Tsinghua): „Visual Design & Layout" ist über alle Systeme die schlechteste Dimension, bester Wert 62,8/100 | das ungelöste Problem des Marktes ist Layout, nicht Prosa — genau Slideos Bühnen-/Validator-Terrain | [arxiv.org](https://arxiv.org/html/2603.07244v1) [H] |
| **06.03.2026** | Gamma ChatGPT-App + volle Zapier/Make/n8n-Parität | Distribution der Gegenseite ist plattformübergreifend | [developers.gamma.app](https://developers.gamma.app/reference/changelog) [H] |
| **31.03.2026** | Gemini in Google Slides: Volldeck-Generierung mit **Plan-Freigabe** und Stil-Match aus vorhandenem Deck | setzt zwei neue Erwartungen: Outline-Approval und Brand-Ingest | [workspaceupdates.googleblog.com](https://workspaceupdates.googleblog.com/2026/04/enerate-beautiful-and-editable-slides-with-ease-in-Google-Slides.html) [H] |
| **08.04.2026** | Touying v0.7.1: `breakable`/`clip`/`detect-overflow` unter dem PR-Titel **`feat(agents)`** | ausdrücklich, weil Agenten zu viel Inhalt produzieren — Bestätigung des Problems | [github.com/touying-typ/touying/pull/336](https://github.com/touying-typ/touying/pull/336) [H] |
| **15.04.2026** | Microsoft streicht kostenlosen Copilot Chat in Word/Excel/PowerPoint | KI-in-App wandert hinter $30/Nutzer/Monat → Preisanker verschiebt sich zu Slideos Gunsten | [office-watch.com](https://office-watch.com/2026/microsoft-removes-copilot-chat-word-excel-powerpoint-april-2026/) [H] |
| **16.04.2026** | **Claude Design (Anthropic × Canva)** auf Claude Pro/Max/Team/Enterprise: Pitch-Decks in Claude bauen, Ausgabe nach Canva | die direkteste Bedrohung — Slideos exakte Zielgruppe bekommt denselben Workflow mit 100M+ Assets am anderen Ende | [forbes.com.au](https://www.forbes.com.au/news/innovation/canva-create-2026-melanie-perkins-unveils-canva-ai-2-0-and-claude-design-deal/) [M — Mechanismus (MCP oder Connector) nicht offengelegt] |
| **22.04.2026** | **Copilot Agent Mode GA und Default** in Word/Excel/PowerPoint: Schritt-Sidebar, Live-Undo, per-Schritt-Bestätigung per Admin-Policy | die Referenz-UX, die jeder Mainstream-Nutzer mitbringt, bevor er Slideo öffnet | [office-watch.com](https://office-watch.com/2026/copilot-agent-mode-word-excel-powerpoint/) [H] |
| **24.04.2026** | ADA Title II: WCAG 2.1 AA verpflichtend | A11y-Check wird Compliance-Thema | [serc.carleton.edu](https://serc.carleton.edu/serc/authoring/ppt_accessibility_checklist.html) [H] |
| **28.04.2026** | **Claude for Creative Work**: 9 MCP-Connectors in laufende Desktop-Apps; Affinity zeigt „Enable Affinity MCP" als eigenen Settings-Schalter | Anthropic legitimiert Slideos exakte Architektur **und** UX — und **kein Präsentationsprogramm ist dabei**. Chance und Risiko zugleich | [anthropic.com](https://www.anthropic.com/news/claude-for-creative-work), [xda-developers.com](https://www.xda-developers.com/connected-claude-to-affinity-batch-edit-designs-write-scripts/) [H] |
| **07.05.2026** | Anthropic: native Office-Add-ins für Excel/Word/PowerPoint/Outlook (Win/Mac/Web) | Plattform-Bündelung schließt sich | [track 1] [M] |
| **21.05.2026** | OpenAI: offizielles ChatGPT-PowerPoint-Add-in | dito, von der anderen Seite | [track 1] [M] |
| **27.05.2026** | **Polar schließt den „Early Member"-Tarif** (4 % + 40¢) für neue Organisationen | eine heute angelegte Slideo-Org zahlt 5 % + 50¢ (+1,5 % Auslandskarten, $15/Dispute) — ~$5,45 auf $99 | [polar.sh/blog](https://polar.sh/blog/introducing-polar-plans) [H] |
| **~06.2026** | **Canva Offline** für alle Nutzer kostenlos — aber Vor-Markierung nötig, 14-Tage-Fenster, keine KI, keine Bibliothek, keine Exporte, keine neuen Designs | „funktioniert offline" ist kommodifiziert; nur noch das **Delta** ist verkaufbar | [socialsamosa.com](https://www.socialsamosa.com/industry-updates/canva-launches-offline-mode-12021595) [H] |
| **10.07.2026** | **Slidev v52.17.0: eingebauter MCP-Server** (HTTP `/__mcp` + `slidev mcp` stdio, 8 Tools inkl. Live-Navigation) | das nächste strukturelle Analogon existiert jetzt — kostenlos, aber Node/Vite/Vue und ohne GUI | [github.com/slidevjs/slidev/pull/2661](https://github.com/slidevjs/slidev/pull/2661), [sli.dev/features/mcp](https://sli.dev/features/mcp) [H] |
| **13.07.2026** | **Google: offizieller Slides-MCP-Server** (Developer Preview, 2 Tools, OAuth + GCP-Projekt, u. a. für Claude) | „KI autort ein Deck über MCP" ist offiziell validiert — und damit als Kategorie besetzt | [developers.google.com](https://developers.google.com/workspace/slides/api/guides/configure-mcp-server) [H] |
| **15.07.2026** | Microsoft: MCP-Agenten in Word/Excel/PowerPoint im Web; Brand Kit automatisch aus einem Guidelines-Dokument erzeugbar | drei Inkumbenten sind innerhalb eines Quartals in den MCP-Kanal eingezogen | [learn.microsoft.com](https://learn.microsoft.com/en-us/microsoft-365/copilot/release-notes) [H] |
| **28.07.2026** | **MCP-Spec-Revision:** stateless, Multi Round-Trip Requests ersetzen Elicitation, Sampling/Roots/Logging deprecated (≥12 Monate) | Slideo pinnt `2025-06-18`; für einen stdio-Shim größtenteils harmlos, aber ein Kompatibilitätsdurchlauf ist überfällig | [blog.modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-07-28/) [H] |
| **01.09.2026** *(in ~4 Wochen)* | **Homebrew deaktiviert alle Casks, die den macOS-Gatekeeper-Check nicht bestehen** (387 von 7.624 betroffen) | ohne Signierung + Notarisierung ist Slideo ab diesem Datum in `homebrew/cask` nicht listbar | [github.com/orgs/Homebrew/discussions/6482](https://github.com/orgs/Homebrew/discussions/6482) [H] |

**Bewusst verworfen / als schwach markiert:** 6sense-Marktanteile (Canva 59,8 % vs. PowerPoint 16,2 %) — die Methode erkennt Web-Technologien auf Firmenseiten und unterzählt Desktop-PowerPoint systematisch, **nicht als Installed-Base-Evidenz verwendbar** [N]. Ebenso: die „14 % des Volumens über MCP"-Zahl von 2Slides, die Reddit-Prozentwerte von slidegmm, Onboarding-/Trial-Conversion-Benchmarks aus Anbieter-Blogs, Canvas exakte 2026er Preise (Quellen widersprechen sich), Setapps 85/15-Split (in Setapps eigener Doku nicht bestätigt), Decksets Mac-Preis (Preisseite liefert 403), Product-Hunt-Wirksamkeit (Kommentarlage 2026 gespalten) — alle **[N]**.

---

## 6. Sechs Lehren für das Produkt

### 1. Nicht mehr mit MCP führen — mit dem, was danach passiert
Innerhalb von zwölf Monaten haben Gamma, Google, Microsoft, Slidev, Presenton und ein halbes Dutzend Hosted-Dienste MCP-Oberflächen geliefert; Anthropic hat mit Claude Design und den neun Creative-Work-Connectors sowohl die Generierung als auch das „KI steuert meine laufende App"-Muster selbst besetzt. **Die verteidigbare Aussage ist nicht mehr „deine KI baut das Deck", sondern: die KI bedient ein Designsystem (nicht nur Text) in einer laufenden lokalen App (nicht in einer Datei oder Cloud), und der Mensch korrigiert live darüber (was sonst niemand anbietet).** Der Demo-Satz ist nicht „MCP", sondern: 37 semantische Tools gegen Googles zwei, ohne OAuth, ohne Cloud-Projekt, und man sieht es passieren.

### 2. Overflow ist der Kernbeweis — und die Prüfung muss echt sein und dem Menschen gehören
Drei Schienen kommen unabhängig hier heraus: der Markt hat Layout nicht gelöst (PresentBench 62,8/100), Auto-fit ist überall Standard und Slideo hat es nicht, und Slideos Detektor ist die schwächste Ausprägung im Feld (Heuristik ohne Rendering) *und* für Menschen unsichtbar. Slideo hat als einziger bereits ein Live-Iframe-Rendering jeder Folie. Aus einer Schwäche wird hier ein benanntes Feature: **`scrollHeight` gegen die Safe Area messen, dasselbe Ergebnis an Mensch (Badge auf der Karte) und KI (`check_zone_overflow`) zurückgeben, plus Auto-fit mit hartem Font-Minimum.** Marps Lehre mitnehmen: **opt-in**, weil eine Diagnose, die 40 Warnungen wirft, als aufdringlich empfunden wird.

### 3. Ein KI-verfasstes Deck ohne Bilder sieht unfertig aus
Zwei Schienen nennen unabhängig dieselbe Sache die größte konkrete Lücke. Die „keine Binärdaten über MCP"-Haltung ist richtig und muss nicht aufgegeben werden — ein Tool, das einen **lokalen Dateipfad** annimmt, löst es vollständig: der Claude-Client des Nutzers hat gerade ein Bild erzeugt oder heruntergeladen und weiß, wo es liegt. Direkt daneben liegt die zweite Hälfte derselben Idee: **die KI kann nicht sehen, was sie gebaut hat.** Slideo rendert bereits offscreen 1280×720; ein `render_slide_png` als MCP-Image-Block schließt die Selbstkorrekturschleife — und passt exakt zu MCP Apps, um dieses Rendering im Chat zu zeigen.

### 4. Das erste Urteil fällt an der langweiligen Mechanik, nicht am Keil
Redo, Folie duplizieren, Kopieren/Einfügen, Mehrfachauswahl, Thumbnail-Leiste, Sections, Autosave, mehr als vier Tastaturkürzel — alles universell vorhanden, alles im Repo verifiziert nicht vorhanden. Ein Rezensent, der §20-Direktmanipulation nie entdeckt, weil er in den ersten zwei Minuten Cmd+Shift+Z drückt und nichts passiert, schreibt „unfertig". **Fehlendes Redo ist in einer KI-Authoring-App besonders teuer**, weil der Nutzer permanent KI-Änderungen zurücknimmt und wiederherstellen will — und weil eine KI-Runde heute 12 Undo-Schritte erzeugt statt einem. Die Reihenfolge ist: erst Redo + Turn-Undo + Autosave, dann alles andere.

### 5. Das Trial-Modell ist von der falschen Seite geliehen
Read-only-nach-Ablauf hat zwei klare Präzedenzfälle — Sketch und 1Password — und in **beiden** trifft es Kunden, die **bereits bezahlt** hatten und deren Abo auslief; es ist eine Datenerhaltungs-Geste, keine Bezahlschranke. Niemand im Vergleichsfeld wendet es auf jemanden an, der nie bezahlt hat. Die Slideo strukturell ähnlichsten Produkte (TablePlus: 2 Tabs/2 Fenster/2 Filter, unbegrenzt lange; Sublime: Nagware ohne Zeitlimit; Craft: Block-Cap, Bearbeiten bleibt erlaubt) fahren **unbegrenzte, fähigkeitsbeschränkte** Evaluationen. Für Slideo ist das doppelt relevant, weil die **installierte MCP-Registrierung selbst der Distributionskanal ist**: ein abgelaufenes Slideo bleibt im Claude-Client sichtbar, die KI ruft ein Tool auf und bekommt einen Fehler — schlechter als gar nicht da zu sein, und zwar genau im Client, der der Wachstumsschleife dienen soll. Dazu die zweite Hälfte: kein Konto, keine E-Mail, keine Karte heißt auch **kein einziger Conversion-Hebel am Tag 30**.

### 6. Der Engpass ist Auslieferbarkeit, nicht Funktionsumfang
Vier im Repo verifizierte Blocker stehen zwischen einem funktional weit entwickelten Produkt und jedem Vertriebskanal: **keine macOS-Signierung/Notarisierung** (und Homebrew deaktiviert Gatekeeper-durchfallende Casks am **01.09.2026**), **kein Windows-Signaturpfad** (Azure Artifact Signing ist für *Einzelentwickler* auf USA/Kanada begrenzt — ein deutscher Einzelunternehmer braucht eine EU-Organisation oder ein OV-Zertifikat mit HSM, $150–300/Jahr), **kein Auto-Updater** (bei einer Perpetual-Lizenz, deren Wert nach Jahr eins genau die Updates sind, ist das inkohärent), und **eine deutschsprachige UI** gegen eine ausnahmslos englischsprachige Zielgruppe und englischsprachige Kanäle (MCP-Registry, Connectors Directory, Homebrew, HN, r/ClaudeAI). Die MCP-Oberfläche ist bereits englisch — das Produkt ist in der falschen Hälfte lokalisiert: **die KI kann es lesen, der Käufer nicht.** $99/Jahr Apple Developer Program ist der billigste Freischalter im gesamten Plan und öffnet gleichzeitig Homebrew, Setapp Single-App-Distribution und einen warnungsfreien Erststart.

---

### Anhang: Was ausdrücklich *nicht* zu jagen ist

Share-Links mit Viewer-Analytics, Echtzeit-Multiplayer mit Kommentaren und Live-Cursorn, mobiles Editieren, Publikum-folgt-auf-eigenem-Gerät (Multiplex), Deck-zu-Video, Speaker Coach. Alle sind auf jedem bezahlten Cloud-Tarif Table Stakes und für eine Backend-lose lokale App strukturell unerreichbar. Die ehrlichen Substitute existieren bereits (selbst-enthaltener HTML-Export zum Selbst-Hosten; responsiver Standalone-Export fürs Handy-Viewing; das teilbare Projektor-Fenster für Zoom/Meet) und gehören in eine FAQ, nicht in die Roadmap. Die einzige Ausnahme mit echtem Preis-Leistungs-Verhältnis: eine **LAN-Fernbedienung fürs Handy** (weiter/zurück/Notizen/Timer) — der lokale Socket und der fensterübergreifende Event-Bus existieren bereits.
