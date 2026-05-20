# Decisions

A running log of design decisions and their rationale. Each entry is one line.

## Tooling / scaffolding

- **Biome formatter: tabs, 100 cols, single quotes, semicolons, trailing commas** — matches prompt spec; trailing commas reduce diff noise.
- **Vitest config at root with workspace include glob** — single test runner config, packages don't each need their own.
- **tsup for library builds (core/render/cli/mcp)** — fast, zero-config dual ESM/CJS + d.ts output, per locked stack.
- **Changesets `ignore: ["web"]`** — the web app is not a published package, so it's excluded from versioning.
- **Node ESM (`"type": "module"`) across all packages** — modern default; CLI/MCP shebang entrypoints target ESM.
