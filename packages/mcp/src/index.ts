import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

export { createServer } from './server.js';
export * from './tools.js';

async function main(): Promise<void> {
	const server = createServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

// Start the server only when executed directly (the bin entry), not when imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err) => {
		console.error('fretdown-mcp failed to start:', err);
		process.exit(1);
	});
}
