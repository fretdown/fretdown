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
- **A connector chain (e.g. `s5f2h3`) is one beat → render the first fret + a technique annotation; bends use VexFlow's `Bend`** — a `TabNote` is a single attack, so multi-fret transitions within one beat are shown as annotations (`h3`, `/3`, `pm`) rather than multiple noteheads. **Known v1 limitation**, noted for review.
- **Voices use SOFT mode** — the core validator already guarantees measures are well-formed, so strict tick-counting (which dotted/tuplet face-values complicate) isn't needed for layout.
- **Rests render as VexFlow `GhostNote`** — tab has no standard rest glyph; a ghost preserves spacing.

## Web playground

- **`/spec` uses `react-markdown` + `remark-gfm`, not MDX** — the locked stack named MDX, but the spec's EBNF (`grammar.md`) is full of `{ }` and `< >` that MDX parses as JSX/expressions and chokes on. react-markdown renders the external `.md` files verbatim and still supports the required live-rendering of `@track` examples via a custom `pre` renderer. **Deviation from locked stack — flagged for review.**
- **Live tab examples only render fences containing `@track`** — many spec snippets are partial (a single measure) and aren't complete scores; rendering those would show spurious errors, so only complete documents get a live preview.
- **Tailwind v3 + hand-written shadcn-style primitives (Button/Card)** — avoids the interactive `shadcn` CLI init (and its network/registry calls) while keeping the same cva + Radix-flavored component shape.
- **`@fretdown/render/browser` subpath import in the web app** — the playground renders client-side with VexFlow against the real DOM, never bundling jsdom.
- **Share links base64url-encode the source into the location hash** — no backend needed; round-trips UTF-8 safely.
- **Monaco loaded via `next/dynamic` with `ssr: false`** — the editor is browser-only; the `/play` route ships a tiny shell and lazy-loads the editor.
