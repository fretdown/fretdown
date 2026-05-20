# Fretdown

> Markdown for guitar and bass tabs.

**Fretdown** is an open-source, plaintext notation format for fretted instruments. It's
text-first, git-friendly, deterministically parseable, and validator-backed.

```fretdown
@title "Sunshine Riff"
@tempo 120
@time 4/4

@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4

intro:
  |: s6f0:8 s6f0 s5f2 s6f0 s4f2 s6f0 s5f2h3 s5f2 :|x2
```

- **Text-first** — write tabs in any editor; no binary blobs.
- **Deterministic parse** — one document, one interpretation (a real Chevrotain grammar).
- **Validator-backed** — fret/string ranges, measures that fill the bar, and section
  references are checked with precise diagnostics.
- **Fretted-instrument-agnostic** — guitar, bass, 7-string, ukulele, and beyond.

## Packages

| Package | Description |
| --- | --- |
| [`@fretdown/core`](./packages/core) | Parser (Chevrotain), IR + validator (Zod), serializer, ASCII import |
| [`@fretdown/render`](./packages/render) | VexFlow → SVG renderer (Node + browser entries) |
| [`@fretdown/cli`](./packages/cli) | `fretdown` command-line tool |
| [`@fretdown/mcp`](./packages/mcp) | Model Context Protocol server |
| [`web`](./apps/web) | Next.js playground + spec site |

## Quick start

```sh
pnpm install
pnpm build
pnpm test
```

Try it:

```sh
# validate and render a file
node packages/cli/dist/index.js validate fixtures/sunshine-riff.fd
node packages/cli/dist/index.js render  fixtures/sunshine-riff.fd --out out.svg

# run the playground (Monaco editor + live render)
pnpm --filter web dev   # http://localhost:3000/play
```

Use the library directly:

```ts
import { parse, validate } from '@fretdown/core';
import { renderToSVG } from '@fretdown/render';

const { score } = parse(source);
const problems = validate(score!);
const svg = renderToSVG(score!);
```

## Documentation

- The notation reference lives in [`spec/`](./spec) and renders at `/spec` in the web app.
- Every design decision is logged in [`DECISIONS.md`](./DECISIONS.md).

## Contributing

This is a pnpm + Turborepo monorepo (Node 20+).

```sh
pnpm install        # install everything
pnpm build          # build all packages (tsup / next)
pnpm test           # run all unit + snapshot tests (Vitest)
pnpm typecheck      # tsc --noEmit across packages
pnpm lint           # Biome (run `pnpm lint:fix` to auto-fix)
pnpm changeset      # describe a change for release (Changesets)
```

Guidelines:

- Write tests alongside code; a change isn't done until `pnpm test` passes.
- Run `pnpm lint:fix` before committing (Biome: tabs, 100 cols, single quotes).
- Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
- Add a changeset for any user-facing package change.
- If a change isn't dictated by the spec, add a one-line rationale to `DECISIONS.md`.

## License

MIT
