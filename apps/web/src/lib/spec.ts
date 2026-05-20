import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface SpecDoc {
	file: string;
	content: string;
}

const ORDER = [
	'index.md',
	'01-file-structure.md',
	'02-instruments-tuning.md',
	'03-measures-beats.md',
	'04-notes-rhythm.md',
	'05-techniques.md',
	'06-structure.md',
	'07-example.md',
	'grammar.md',
];

/** Reads the spec markdown files from the repo's /spec directory at build time. */
export function readSpec(): SpecDoc[] {
	const dir = resolve(process.cwd(), '..', '..', 'spec');
	const present = new Set(readdirSync(dir).filter((f) => f.endsWith('.md')));
	const files = ORDER.filter((f) => present.has(f));
	return files.map((file) => ({ file, content: readFileSync(join(dir, file), 'utf8') }));
}
