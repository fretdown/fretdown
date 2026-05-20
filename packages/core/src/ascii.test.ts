import { describe, expect, it } from 'vitest';
import { parseAsciiTab } from './ascii.js';
import { parse } from './index.js';

const GUITAR_TAB = `e|---0---3---|
B|---1---1---|
G|---0---0---|
D|-----------|
A|-----------|
E|-3-------3-|`;

const BASS_TAB = `G|-----------|
D|-----2-----|
A|-0-------0-|
E|-----------|`;

describe('parseAsciiTab', () => {
	it('detects a 6-string guitar block and guesses guitar tuning', () => {
		const result = parseAsciiTab(GUITAR_TAB);
		expect(result.score).not.toBeNull();
		const track = result.score!.tracks[0]!;
		expect(track.instrument).toBe('guitar');
		expect(track.tuning).toHaveLength(6);
		expect(result.ambiguities).toContain('tuning-guessed');
		expect(result.ambiguities).toContain('rhythm-approximated');
	});

	it('detects a 4-string bass block', () => {
		const result = parseAsciiTab(BASS_TAB);
		expect(result.score!.tracks[0]!.instrument).toBe('bass');
		expect(result.score!.tracks[0]!.tuning).toHaveLength(4);
	});

	it('places frets on the correct strings (top line = string 1)', () => {
		const result = parseAsciiTab(GUITAR_TAB);
		const notes = result.score!.tracks[0]!.sections[0]!.items.flatMap((i) =>
			'beats' in i ? i.beats : [],
		);
		// First column has E string fret 3 (string 6) and B string fret? -> the '0' on e (string 1)
		const strings = notes.flatMap((b) =>
			b.kind === 'chord' ? b.notes.map((n) => n.string) : b.kind === 'note' ? [b.note.string] : [],
		);
		expect(strings).toContain(1); // high e
		expect(strings).toContain(6); // low E
	});

	it('produces parseable Fretdown text', () => {
		const result = parseAsciiTab(GUITAR_TAB);
		expect(result.fretdown).toBeTruthy();
		const reparsed = parse(result.fretdown!);
		expect(reparsed.score).not.toBeNull();
		// No lexer/parser errors (rhythm/measure-fill issues may still be reported by validate).
		expect(reparsed.diagnostics.filter((d) => d.code.startsWith('parse'))).toEqual([]);
	});

	it('reports low confidence and a flag for an unrecognized block', () => {
		const result = parseAsciiTab('just some prose with no tab here');
		expect(result.score).toBeNull();
		expect(result.confidence).toBe(0);
		expect(result.ambiguities).toContain('no-tab-block-found');
	});

	it('captures hammer-ons as connector events', () => {
		const tab = `e|-----------|
B|-----------|
G|-5h7-------|
D|-----------|
A|-----------|
E|-----------|`;
		const result = parseAsciiTab(tab);
		expect(result.ambiguities).toContain('techniques-approximated');
		const found = JSON.stringify(result.score).includes('"connector":"h"');
		expect(found).toBe(true);
	});
});
