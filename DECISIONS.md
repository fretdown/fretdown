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
