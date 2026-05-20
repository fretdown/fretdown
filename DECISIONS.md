# Decisions

A running log of design decisions and their rationale. Each entry is one line.

## Tooling / scaffolding

- **Biome formatter: tabs, 100 cols, single quotes, semicolons, trailing commas** — matches prompt spec; trailing commas reduce diff noise.
- **Vitest config at root with workspace include glob** — single test runner config, packages don't each need their own.
- **tsup for library builds (core/render/cli/mcp)** — fast, zero-config dual ESM/CJS + d.ts output, per locked stack.
- **Changesets `ignore: ["web"]`** — the web app is not a published package, so it's excluded from versioning.
- **Node ESM (`"type": "module"`) across all packages** — modern default; CLI/MCP shebang entrypoints target ESM.

## Spec v0.1

- **Directives use `@name` sigil; one per line** — visually distinct from music, trivially lexable, newline-terminated.
- **`#` for comments (to end of line)** — single comment style; `#` inside identifiers (e.g. `F#3`) is unambiguous because comments only start a token.
- **String numbering: s1 = highest pitch** — matches conventional tab (top line is string 1).
- **`@tuning` lists pitches low→high (highest string number → s1)** — matches how players say tunings; pitch count defines string count.
- **Note token is compact, single-string-chain: `s<S>f<F>` with connectors between fret numbers** — mirrors how ASCII tab encodes hammer/pull/slide/bend on one string; self-delimiting and unambiguous.
- **Connectors: `h p / \ b r`; articulations: dot-keywords (`.pm`, `.vib`, …)** — connectors are positional (between frets), articulations are named/extensible.
- **Bends specify TARGET FRET, not semitone offset** — `b9` = bend to the pitch of fret 9; unambiguous given tuning, matches reader intuition, semitones are derivable. **FLAGGED FOR REVIEW** (this was the prompt's example of a genuine fork).
- **Durations as denominators `:1 :2 :4 :8 :16 :32`, trailing `.` = dotted** — compact, unambiguous, no clash with technique letters.
- **Duration carries over within a track, default `:4`** — friendlier authoring (matches GuitarPro); resolved deterministically during IR normalization.
- **Rest is `_` (not `r`)** — keeps `r` free as the bend-release connector and avoids beat/connector ambiguity.
- **Tuplets via `tN( … )`, N-in-time-of-prev-power-of-two** — standard musical semantics; `t3` triplet, `t5` quintuplet.
- **Sections (`label:`) are separate from arrangement (`@arrange`)** — a short doc can describe a long song; `@arrange` references validated against existing labels.
- **Note-atom internals decoded by a dedicated tested routine, not Chevrotain tokens** — avoids single-letter token collisions (h/p/b/r vs identifiers) and keeps the document grammar small; the decoder has its own production-level tests.

## Core implementation

- **One token type per directive keyword (`@title`, `@track`, …)** — Chevrotain's grammar must be static; branching on a token's `.image` inside a rule breaks the self-analysis/recording phase, so distinct tokens make every production statically reachable.
- **Parser emits a flat `MusicItem[]` per section; measures assembled in `build.ts`** — shared barlines + voltas are awkward in a structured grammar; a tested assembly pass is clearer and handles repeat/volta attachment deterministically.
- **Sub-rules return values rather than mutating passed-in ARGS** — ARGS are undefined during Chevrotain's recording phase, which would crash action code; returning partials and merging in the caller avoids it.
- **Measure-fill checked with float fractions of a whole note + epsilon tolerance** — exact for dyadic durations and close enough for tuplet ratios (2/3, 4/5) without a rational-number dependency.
- **No `composite`/project-references in tsconfigs** — tsup's `.d.ts` rollup conflicts with composite's "all files must be listed"; each package typechecks independently via its own include.

## Render

- **Headless rendering via jsdom with stubbed SVG text metrics** — VexFlow's SVG backend wants a DOM and `getBBox`; jsdom plus a constant-size `getBBox`/`getComputedTextLength` stub yields deterministic SVG (only sub-pixel text placement is approximate, which is fine for snapshots).
- **`TabStave`/`TabNote` with `num_lines` from the tuning** — Fretdown is tab-native, so VexFlow's tab primitives map directly; 4-line bass vs 6-line guitar driven by string count.
- **A connector chain (e.g. `s5f2h3`) expands into multiple `TabNote`s joined by VexFlow connectors** — hammer/pull use `TabTie.createHammeron`/`createPulloff`, slides use `TabSlide.createSlideUp`/`createSlideDown`, drawn after the voice is laid out (they read note coordinates). The beat's duration is subdivided evenly across the chain so ticks stay aligned, but only when the chain length is a power of two and the per-note value is ≤ a 32nd; dead/dotted notes, non-transition connectors (`b`/`r`), and chains inside tuplets fall back to the single-note + annotation rendering. Bends still attach a `Bend` modifier to one note (a bend is a single attack). _(Supersedes the original v1 limitation of rendering only the first fret + a text annotation.)_
- **Voices use SOFT mode** — the core validator already guarantees measures are well-formed, so strict tick-counting (which dotted/tuplet face-values complicate) isn't needed for layout.
- **Rests render as VexFlow `GhostNote`** — tab has no standard rest glyph; a ghost preserves spacing.
- **Per-string tuning labels are drawn in a left gutter, not via a VexFlow feature** — VexFlow's TabStave doesn't label string tunings, so each row reserves a fixed `TUNING_GUTTER` and the open-note letter for each line is drawn there (top line = highest string, since the tuning array is low→high). The gutter shifts measure x uniformly in the shared `planLayout`, so `computeLayout` (and the playback cursor) stay aligned.

## Export (MIDI / MusicXML)

- **MIDI written by a hand-rolled SMF encoder in `core/midi.ts` — no dependency** — a Standard MIDI File is a small, well-specified byte format; emitting it directly keeps `core` dependency-free (the repo's hard rule) and fully deterministic. Format 1: a conductor track (tempo + time signature) plus one track per instrument.
- **PPQ 480 for MIDI, divisions 24 for MusicXML** — both make every supported duration integral, including eighth-note triplets (480/3, 24·2/3) and 32nd notes; avoids a rational-number dependency.
- **Pitch = `tuning[length − string]` open pitch + fret + capo** — the tuning array is low→high (highest string number maps to `s1`), so the open pitch for `note.string` is indexed from the end; capo raises the sounding pitch while tab fret numbers stay relative to it.
- **Hammer/pull/slide chains play/notate their target frets, not just the start** — MIDI subdivides the beat across the chain with float steps (any chain length); MusicXML reuses the renderer's power-of-two subdivision rule and connects notes with `<slur>`/`<slide>`. Keeps audio/notation consistent with the SVG.
- **Dead notes are silent in MIDI and `<unpitched>` in MusicXML; bends play/notate the start fret** — a muted string has no pitch, and MusicXML bend markup is out of scope for v1.

## Editor tooling

- **A portable TextMate grammar in `grammars/` mirrors the playground's Monaco/Monarch tokenizer** — the playground already had Monarch highlighting + validator markers, but nothing worked outside it; the `.tmLanguage.json` (scope `source.fretdown`) gives VS Code / GitHub Linguist / Sublime the same highlighting without depending on Monaco.

## Web playground

- **`/spec` uses `react-markdown` + `remark-gfm`, not MDX** — the locked stack named MDX, but the spec's EBNF (`grammar.md`) is full of `{ }` and `< >` that MDX parses as JSX/expressions and chokes on. react-markdown renders the external `.md` files verbatim and still supports the required live-rendering of `@track` examples via a custom `pre` renderer. **Deviation from locked stack — flagged for review.**
- **Live tab examples only render fences containing `@track`** — many spec snippets are partial (a single measure) and aren't complete scores; rendering those would show spurious errors, so only complete documents get a live preview.
- **Tailwind v3 + hand-written shadcn-style primitives (Button/Card)** — avoids the interactive `shadcn` CLI init (and its network/registry calls) while keeping the same cva + Radix-flavored component shape.
- **`@fretdown/render/browser` subpath import in the web app** — the playground renders client-side with VexFlow against the real DOM, never bundling jsdom.
- **Share links base64url-encode the source into the location hash** — no backend needed; round-trips UTF-8 safely.
- **Built-in samples live in `lib/samples.ts` as inlined source, picked from a dropdown** — the playground has no backend/filesystem, so demo songs are inlined strings (the first reuses `EXAMPLE_SOURCE`); a test parses+validates every sample so a broken one can't ship. Loading a sample clears the share-link hash.
- **ASCII-tab import is a modal that calls core's `parseAsciiTab` client-side** — same deterministic conversion the CLI `convert` and MCP `parse_ascii_tab` use, no new logic; the result is loaded into the editor with a header comment noting the confidence % and ambiguity flags so the approximation is explicit.
- **Monaco loaded via `next/dynamic` with `ssr: false`** — the editor is browser-only; the `/play` route ships a tiny shell and lazy-loads the editor.
- **Playback uses `webaudio-tinysynth` (a self-contained GM synth), not a sample/soundfont loader** — no external sample files to fetch, works offline, and each track plays its instrument's GM program. `webaudio-tinysynth` is dynamically `import()`-ed inside the player so it stays out of the `/play` first-load bundle.
- **The playground's instrument dropdown solos a track, it doesn't change timbre** — the tracks already carry their instrument (guitar/bass), so the dropdown picks _which_ track you hear ("All instruments" or one track); `buildTimeline(score, onlyTrack)` filters events to that track. (A per-track GM-instrument picker was tried first and removed: it wasn't what was wanted, and hearing all tracks at once obscured each instrument.)
- **The player schedules with look-ahead (~0.2 s) rather than queuing the whole song** — `tinysynth.send(msg, t)` schedules into Web Audio with no cancel API, so Stop must be able to drop unsounded notes; a `requestAnimationFrame` loop schedules just-in-time and Stop sends all-sound-off per channel.
- **Playback timing is computed in the browser from the IR (`lib/playback.ts`), independent of `toMidi`** — the visual cursor needs second-accurate beat times and per-track channels that the player owns; pitch comes from the shared `noteToMidi` core helper so it matches the MIDI/MusicXML exports.
- **The playback cursor overlays measure boxes from `computeLayout` (render), not per-notehead positions** — every bar has the same time span (the validator guarantees measures fill), so a measure-level highlight + a linear sweep is simple and robust, and avoids mapping expanded chains/rests back to SVG noteheads. `computeLayout` shares `planLayout` with the renderer so coordinates line up exactly.
- **The cursor sweeps from `noteX` (a stave's `getNoteStartX()`), not the bar's left edge** — the first bar reserves width for the clef + time signature, so sweeping from the box edge ran ahead of the notes and they appeared to "catch up." `computeLayout` builds a matching `TabStave` per measure and reports `getNoteStartX()`, so the cursor starts where the notes do.
- **Favicon is `app/icon.svg`** — Next emits the icon links automatically; the SVG reuses the nav's accent `▟` mark so the brand is consistent without a binary `.ico`.

## MCP

- **`serialize(score)` lives in core and always emits explicit durations** — canonical, carry-over-free output that round-trips; used by `convert_ir_to_fretdown`.
- **Tool logic is pure functions in `tools.ts`; `server.ts` only wires MCP** — keeps the deterministic capabilities unit-testable without a transport, honoring "MCP does no reasoning."
- **`parse_ascii_tab` is explicitly best-effort: rhythm approximated to eighth notes, tuning guessed from string count, techniques attached as connector events** — ASCII tab carries no reliable rhythm, so the tool returns a confidence score and ambiguity flags rather than pretending to be exact.
- **The importer ignores ASCII barlines and chunks notes into bar-sized measures, padding the last with rests** — ASCII barline spacing rarely matches real measures, so trusting them produced measures that didn't fill the time signature (a validation error). Chunking by `eighthsPerBar` (8 for 4/4) always yields valid measures. It also trims each line to the first–last `|` so trailing annotations like `(6x)` aren't misread as notes.
- **Server entry guards `main()` with an `argv[1] === import.meta.url` check** — so importing the module in tests doesn't start a stdio server.

## CLI

- **`parseAsciiTab` moved from mcp into core** — both the CLI `convert` command and the MCP `parse_ascii_tab` tool need it; core is the shared home and keeps the CLI from depending on the MCP server package.
- **CLI command logic split into pure `run*()` functions; `index.ts` only does fs + citty wiring** — so stdout/exit-code behavior is unit-testable without spawning a process.
- **`render` blocks only on parse errors, not validation warnings** — a parseable-but-imperfect score still renders; validation issues surface via `validate`.
- **`convert` emits a commented stub (confidence %, ambiguity TODOs)** — deterministic ASCII import can't recover rhythm, so the output is explicitly flagged for human review.
- **`export` infers format from the `--out` extension (`.mid`/`.midi` → MIDI, `.musicxml`/`.xml` → MusicXML), overridable with `--format`** — matches how `render` already takes `--out`, and lets `runExport` stay a pure function returning bytes-or-string for testing.
