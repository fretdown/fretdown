import { describe, expect, it } from 'vitest';
import { runConvert, runRender, runValidate } from './run.js';

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI for assertions
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const VALID = `@track G
@tuning E2 A2 D3 G3 B3 E4
a:
  | s6f0:4 s5f2 s4f2 s6f0 |
`;

const BAD = `@track G
@tuning E2 A2 D3 G3 B3 E4
a:
  | s6f99:4 s6f0 s6f0 s6f0 |
`;

describe('runValidate', () => {
	it('returns code 0 and a success line for valid input', () => {
		const r = runValidate(VALID, 'a.fd');
		expect(r.code).toBe(0);
		expect(stripAnsi(r.output)).toContain('a.fd is valid');
	});

	it('returns code 1 and located diagnostics for errors', () => {
		const r = runValidate(BAD, 'a.fd');
		expect(r.code).toBe(1);
		const out = stripAnsi(r.output);
		expect(out).toContain('fret.outOfRange');
		expect(out).toMatch(/a\.fd:\d+:\d+/);
	});
});

describe('runRender', () => {
	it('produces SVG for valid input', () => {
		const r = runRender(VALID, 'a.fd');
		expect(r.svg?.startsWith('<svg')).toBe(true);
		expect(r.report.code).toBe(0);
	});

	it('reports an error and no SVG for unparseable input', () => {
		const r = runRender('@track G\n@tuning E2 A2 D3 G3 B3 E4\na:\n  | (s6f0 |\n', 'a.fd');
		expect(r.svg).toBeNull();
		expect(r.report.code).toBe(1);
	});
});

describe('runConvert', () => {
	it('emits a stub with TODO markers and confidence', () => {
		const tab = `e|---0---3---|
B|---1---1---|
G|---0---0---|
D|-----------|
A|-----------|
E|-3-------3-|`;
		const r = runConvert(tab, 'tab.txt');
		expect(r.code).toBe(0);
		expect(r.output).toContain('BEST-EFFORT');
		expect(r.output).toContain('Confidence:');
		expect(r.output).toContain('@track');
	});

	it('reports failure when no tab block is found', () => {
		const r = runConvert('not a tab', 'tab.txt');
		expect(r.code).toBe(1);
	});
});
