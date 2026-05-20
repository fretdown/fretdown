import { parse } from '@fretdown/core';
import { describe, expect, it } from 'vitest';
import {
	convertIrToFretdown,
	exportFretdown,
	renderFretdownToSvg,
	validateFretdown,
} from './tools.js';

const VALID = `@track G
@tuning E2 A2 D3 G3 B3 E4
a:
  | s6f0:4 s5f2 s4f2 s6f0 |
`;

describe('validateFretdown', () => {
	it('reports ok for valid source', () => {
		const result = validateFretdown(VALID);
		expect(result.ok).toBe(true);
		expect(result.diagnostics).toEqual([]);
	});

	it('reports diagnostics for invalid source', () => {
		const result = validateFretdown(
			'@track G\n@tuning E2 A2 D3 G3 B3 E4\na:\n  | s6f99:4 s6f0 s6f0 s6f0 |\n',
		);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.some((d) => d.code === 'fret.outOfRange')).toBe(true);
	});
});

describe('renderFretdownToSvg', () => {
	it('renders valid source to SVG', () => {
		const result = renderFretdownToSvg(VALID);
		expect(result.svg?.startsWith('<svg')).toBe(true);
	});
});

describe('convertIrToFretdown', () => {
	it('serializes a valid IR object', () => {
		const score = parse(VALID).score!;
		const result = convertIrToFretdown(JSON.parse(JSON.stringify(score)));
		expect(result.error).toBeNull();
		expect(result.fretdown).toContain('@track G');
		expect(result.fretdown).toContain('s6f0:4');
	});

	it('returns an error for a malformed IR', () => {
		const result = convertIrToFretdown({ not: 'a score' });
		expect(result.fretdown).toBeNull();
		expect(result.error).toBeTruthy();
	});
});

describe('exportFretdown', () => {
	it('exports MIDI as base64 bytes', () => {
		const result = exportFretdown(VALID, 'midi');
		expect(result.encoding).toBe('base64');
		expect(result.data).toBeTruthy();
		const head = Buffer.from(result.data as string, 'base64')
			.subarray(0, 4)
			.toString('ascii');
		expect(head).toBe('MThd');
	});

	it('exports MusicXML as UTF-8 text', () => {
		const result = exportFretdown(VALID, 'musicxml');
		expect(result.encoding).toBe('utf8');
		expect(result.data).toContain('<score-partwise');
	});
});
