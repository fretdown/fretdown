# AGENTS.md

Guidance for AI agents (and humans) working in the Fretdown monorepo.

## What this is

**Fretdown** is a plaintext notation format for fretted instruments ("Markdown for guitar
and bass tabs"). The repo is a pnpm + Turborepo monorepo (Node 20+, TypeScript strict).

## Layout

```
packages/core     # parser (Chevrotain), IR + validator (Zod), serializer, ASCII import,
                  #   MIDI + MusicXML export (midi.ts / musicxml.ts)
packages/render   # VexFlow → SVG renderer (Node entry + jsdom-free /browser entry)
packages/cli      # `fretdown` CLI: validate / render / export / convert (citty)
packages/mcp      # MCP stdio server exposing 5 deterministic tools
apps/web          # Next.js 15 playground (/play), landing, and /spec site
spec/             # the notation spec (rendered by the web app)
grammars/         # portable TextMate grammar for editor syntax highlighting
fixtures/         # canonical .fd corpus (sunshine-riff.fd)
DECISIONS.md      # running log of every non-obvious design decision
```

Dependency direction: `core` ← `render` ← `cli` / `mcp`; `web` consumes `core` +
`render/browser`. Never make `core` depend on anything else in the repo.

## Commands

```sh
pnpm install            # install workspace
pnpm build              # build all packages (turbo: tsup for libs, next for web)
pnpm test               # all Vitest suites
pnpm typecheck          # tsc --noEmit per package
pnpm lint               # Biome check
pnpm lint:fix           # Biome auto-fix (run before committing)

# scope to one package
pnpm --filter @fretdown/core test
pnpm --filter web dev    # http://localhost:3000/play
```

Build order matters: `render`/`cli`/`mcp` import `@fretdown/core`'s built `dist`, so run
`pnpm build` (or build core first) before typechecking dependents.

## Conventions

- **Biome**: tabs, 100-col width, single quotes, semicolons, trailing commas. Let
  `pnpm lint:fix` sort imports and format — don't hand-format.
- **Tests live next to code** (`*.test.ts`) and must pass before a change is "done".
  Aim for >90% coverage on parser/validator.
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.
- **Changesets**: add one (`pnpm changeset`) for any user-facing package change.
- **Record decisions**: anything not dictated by the spec gets a one-line entry in
  `DECISIONS.md`.
- ESM everywhere; import local files with explicit `.js` extensions.

## Gotchas

- **Chevrotain grammar must be static.** Don't branch on a token's `.image` inside a rule
  (it breaks the recording phase) — use distinct token types and `OR` alternatives, and
  return values from sub-rules rather than mutating passed-in ARGS.
- **The note atom** (`s3f5h7.vib`) is one lexer token decoded by `note-atom.ts`, not a set
  of sub-tokens. Keep its micro-syntax there.
- **Rendering is headless via jsdom** in `render`'s Node entry; the browser uses
  `@fretdown/render/browser` (no jsdom). Don't import jsdom into browser code.
- **`/spec` uses react-markdown, not MDX** (EBNF braces break MDX). See `DECISIONS.md`.
- The parser emits a flat `MusicItem[]`; measures (repeats/voltas) are assembled in
  `build.ts`.

## Spec

The canonical notation reference is in `spec/` (`index.md` + numbered chapters +
`grammar.md`). The worked example `fixtures/sunshine-riff.fd` is the round-trip fixture
used across parser, validator, serializer, and renderer tests — keep it valid.
