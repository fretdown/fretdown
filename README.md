# Fretdown

> Markdown for guitar and bass tabs.

**Fretdown** is an open-source, plaintext notation format for fretted instruments. It's
text-first, git-friendly, deterministically parseable, and validator-backed.

```fretdown
@title "Smoke on the Water"
@artist "Deep Purple"
@tempo 112
@time 4/4

@track guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4

riff:
  | s6f0 s5f3 s4f5 | s6f0 s5f3 s4f6h s4f5 |
```

## Packages

| Package | Description |
| --- | --- |
| [`@fretdown/core`](./packages/core) | Parser (Chevrotain), IR, and validator (Zod) |
| [`@fretdown/render`](./packages/render) | VexFlow → SVG renderer |
| [`@fretdown/cli`](./packages/cli) | `fretdown` command-line tool |
| [`@fretdown/mcp`](./packages/mcp) | Model Context Protocol server |
| [`web`](./apps/web) | Next.js playground + docs |

## Quick start

```sh
pnpm install
pnpm build
pnpm test
```

See the [spec](./spec) for the full notation reference.

## License

MIT
