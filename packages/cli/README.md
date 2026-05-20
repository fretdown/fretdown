# @fretdown/cli

The `fretdown` command-line tool.

## Install

```sh
pnpm add -g @fretdown/cli
# or run from the monorepo: node packages/cli/dist/index.js <command>
```

## Commands

### `fretdown validate <file>`

Parse and validate a `.fd` / `.fretdown` file, printing located, colorized diagnostics.
Exits non-zero if there are errors.

```sh
fretdown validate song.fd
```

### `fretdown render <file> --out <path>`

Render a file to an SVG.

```sh
fretdown render song.fd --out song.svg
```

### `fretdown convert <ascii-file>`

Best-effort conversion of a legacy ASCII tab into Fretdown. Rhythm cannot be recovered
deterministically, so the output is a **stub** with a confidence score and `TODO` markers
for review. Use `--out` to write to a file instead of stdout.

```sh
fretdown convert legacy-tab.txt --out song.fd
```

For full ASCII-tab interpretation, pair the `@fretdown/mcp` server's `parse_ascii_tab`
tool with an LLM host.
