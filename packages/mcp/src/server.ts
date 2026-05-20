import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
	convertIrToFretdown,
	exportFretdown,
	importAsciiTab,
	renderFretdownToSvg,
	validateFretdown,
} from './tools.js';

function json(value: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

/** Builds the Fretdown MCP server. Tools are pure and deterministic — no LLM calls. */
export function createServer(): McpServer {
	const server = new McpServer({ name: 'fretdown', version: '0.1.0' });

	server.registerTool(
		'validate_fretdown',
		{
			description:
				'Parse and validate Fretdown source. Returns structured diagnostics with severity, code, message, and line/column locations.',
			inputSchema: { source: z.string().describe('Fretdown (.fd) source text') },
		},
		async ({ source }) => json(validateFretdown(source)),
	);

	server.registerTool(
		'render_fretdown_to_svg',
		{
			description:
				'Render Fretdown source to an SVG tablature string. Returns the SVG and any diagnostics.',
			inputSchema: { source: z.string().describe('Fretdown (.fd) source text') },
		},
		async ({ source }) => json(renderFretdownToSvg(source)),
	);

	server.registerTool(
		'convert_ir_to_fretdown',
		{
			description:
				'Emit canonical Fretdown (.fd) text from a Fretdown IR (Score) object. Validates the IR shape first.',
			inputSchema: { ir: z.unknown().describe('A Fretdown Score IR object') },
		},
		async ({ ir }) => json(convertIrToFretdown(ir)),
	);

	server.registerTool(
		'parse_ascii_tab',
		{
			description:
				'Best-effort conversion of legacy ASCII guitar/bass tab into a partial Fretdown score. Returns the converted .fd text, the IR, a confidence score (0–1), and ambiguity flags. Rhythm is approximated.',
			inputSchema: { text: z.string().describe('Legacy ASCII tablature') },
		},
		async ({ text }) => json(importAsciiTab(text)),
	);

	server.registerTool(
		'export_fretdown',
		{
			description:
				'Export Fretdown source to MIDI or MusicXML. MusicXML is returned as UTF-8 text; MIDI is returned base64-encoded (see the `encoding` field). Deterministic.',
			inputSchema: {
				source: z.string().describe('Fretdown (.fd) source text'),
				format: z.enum(['midi', 'musicxml']).describe('Output format'),
			},
		},
		async ({ source, format }) => json(exportFretdown(source, format)),
	);

	return server;
}
