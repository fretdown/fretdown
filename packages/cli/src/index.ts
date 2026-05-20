import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { defineCommand, runMain } from 'citty';
import pc from 'picocolors';
import { runConvert, runRender, runValidate } from './run.js';

const validateCmd = defineCommand({
	meta: { name: 'validate', description: 'Validate a Fretdown file and print diagnostics' },
	args: {
		file: { type: 'positional', description: 'Path to a .fd / .fretdown file', required: true },
	},
	run({ args }) {
		const source = readFileSync(args.file, 'utf8');
		const { output, code } = runValidate(source, basename(args.file));
		console.log(output);
		process.exitCode = code;
	},
});

const renderCmd = defineCommand({
	meta: { name: 'render', description: 'Render a Fretdown file to an SVG' },
	args: {
		file: { type: 'positional', description: 'Path to a .fd / .fretdown file', required: true },
		out: { type: 'string', description: 'Output SVG path', alias: 'o', required: true },
	},
	run({ args }) {
		const source = readFileSync(args.file, 'utf8');
		const { svg, report } = runRender(source, basename(args.file));
		if (!svg) {
			console.error(report.output);
			process.exitCode = report.code;
			return;
		}
		writeFileSync(args.out, svg);
		console.log(pc.green(`✓ wrote ${args.out}`));
	},
});

const convertCmd = defineCommand({
	meta: {
		name: 'convert',
		description: 'Best-effort convert legacy ASCII tab to Fretdown (stub, review required)',
	},
	args: {
		file: { type: 'positional', description: 'Path to an ASCII tab text file', required: true },
		out: { type: 'string', description: 'Write output to a file instead of stdout', alias: 'o' },
	},
	run({ args }) {
		const text = readFileSync(args.file, 'utf8');
		const { output, code } = runConvert(text, basename(args.file));
		if (code === 0 && args.out) {
			writeFileSync(args.out, output);
			console.log(pc.green(`✓ wrote ${args.out}`));
		} else {
			console.log(output);
		}
		process.exitCode = code;
	},
});

const main = defineCommand({
	meta: { name: 'fretdown', description: 'Fretdown command-line tools', version: '0.1.0' },
	subCommands: { validate: validateCmd, render: renderCmd, convert: convertCmd },
});

runMain(main);
