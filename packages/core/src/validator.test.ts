import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { Beat } from './ir.js';
import { beatDuration, validate } from './validator.js';

function diagnose(source: string): string[] {
	const { score } = parse(source);
	if (!score) throw new Error('expected a score');
	return validate(score).map((d) => d.code);
}

const track = (body: string, head = '@tuning E2 A2 D3 G3 B3 E4') => `@track G
${head}
a:
${body}
`;

describe('validator', () => {
	it('passes a valid track', () => {
		expect(diagnose(track('  | s6f0:4 s5f2 s4f2 s6f0 |'))).toEqual([]);
	});

	it('flags fret out of range', () => {
		expect(
			diagnose(track('  | s6f0:4 s6f0 s6f0 s6f30 |', '@tuning E2 A2 D3 G3 B3 E4\n@frets 24')),
		).toContain('fret.outOfRange');
	});

	it('flags fret out of range inside a connector chain', () => {
		expect(diagnose(track('  | s6f0:4 s6f0 s6f0 s6f5h99 |'))).toContain('fret.outOfRange');
	});

	it('flags string out of range', () => {
		expect(diagnose(track('  | s9f0:4 s6f0 s6f0 s6f0 |'))).toContain('string.outOfRange');
	});

	it('flags measures that do not fill the time signature', () => {
		expect(diagnose(track('  | s6f0:4 s6f0 s6f0 |'))).toContain('measure.duration');
	});

	it('accepts a triplet that fills the right time', () => {
		expect(diagnose(track('  | t3( s6f0:8 s6f2:8 s6f3:8 ) s6f0:4 s6f0:4 s6f0:4 |'))).toEqual([]);
	});

	it('flags unknown articulations', () => {
		expect(diagnose(track('  | s6f0.bogus:4 s6f0 s6f0 s6f0 |'))).toContain('articulation.unknown');
	});

	it('flags invalid tuning pitches', () => {
		expect(diagnose(track('  | s4f0:4 s4f0 s4f0 s4f0 |', '@tuning H2 A2 D3 J9'))).toContain(
			'tuning.invalidPitch',
		);
	});

	it('flags a track with no tuning', () => {
		expect(diagnose('@track G\na:\n  | s1f0:4 s1f0 s1f0 s1f0 |\n')).toContain('track.noTuning');
	});

	it('warns on unknown instrument', () => {
		const { score } = parse(
			'@track G\n@instrument banjo\n@tuning G4 D3 G3 B3 D4\na:\n  | s1f0:4 s1f0 s1f0 s1f0 |\n',
		);
		expect(validate(score!).map((d) => d.code)).toContain('instrument.unknown');
	});

	it('flags @arrange referencing a missing section', () => {
		const src = `@arrange intro solo

@track G
@tuning E2 A2 D3 G3 B3 E4
intro:
  | s6f0:4 s6f0 s6f0 s6f0 |
`;
		expect(diagnose(src)).toContain('arrange.unknownSection');
	});

	it('validates the worked example with no diagnostics', () => {
		const src = readFileSync(
			fileURLToPath(new URL('../../../fixtures/sunshine-riff.fd', import.meta.url)),
			'utf8',
		);
		const { score } = parse(src);
		expect(validate(score!)).toEqual([]);
	});
});

describe('beatDuration', () => {
	const q: Beat = {
		kind: 'rest',
		duration: { value: 4, dotted: false },
		location: { line: 0, col: 0, length: 0 },
	};
	it('computes simple and dotted values', () => {
		expect(beatDuration(q)).toBeCloseTo(0.25);
		const dottedQuarter: Beat = { ...q, duration: { value: 4, dotted: true } };
		expect(beatDuration(dottedQuarter)).toBeCloseTo(0.375);
	});

	it('computes triplet totals', () => {
		const eighth = (): Beat => ({
			kind: 'rest',
			duration: { value: 8, dotted: false },
			location: { line: 0, col: 0, length: 0 },
		});
		const triplet: Beat = {
			kind: 'tuplet',
			n: 3,
			beats: [eighth(), eighth(), eighth()],
			location: { line: 0, col: 0, length: 0 },
		};
		expect(beatDuration(triplet)).toBeCloseTo(0.25);
	});
});
