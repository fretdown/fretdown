# @fretdown/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server exposing Fretdown's
deterministic capabilities to an MCP host (such as Claude Desktop). **The server does no
LLM calls itself** — it offers pure, deterministic tools; the host model does the
reasoning.

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `validate_fretdown` | `source: string` | `{ ok, diagnostics }` — structured diagnostics with severity, code, message, and `{ line, col, length }`. |
| `render_fretdown_to_svg` | `source: string` | `{ svg, diagnostics }` — SVG tablature string. |
| `convert_ir_to_fretdown` | `ir: object` | `{ fretdown, error }` — canonical `.fd` text from a Score IR. |
| `parse_ascii_tab` | `text: string` | `{ score, fretdown, confidence, ambiguities }` — best-effort import of legacy ASCII tab (rhythm approximated). |

## Install

```sh
pnpm add -g @fretdown/mcp   # or run via the workspace build below
```

Build from the monorepo:

```sh
pnpm --filter @fretdown/mcp build
# server entry: packages/mcp/dist/index.js
```

## Use with Claude Desktop

Add to `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fretdown": {
      "command": "node",
      "args": ["/absolute/path/to/fretdown/packages/mcp/dist/index.js"]
    }
  }
}
```

If installed globally, you can instead use the `fretdown-mcp` binary:

```json
{
  "mcpServers": {
    "fretdown": {
      "command": "fretdown-mcp"
    }
  }
}
```

Restart Claude Desktop; the four Fretdown tools will appear.

## Transport

stdio. The server reads JSON-RPC on stdin and writes responses on stdout, so keep stdout
free of other output.
