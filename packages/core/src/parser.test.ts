import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { Beat, Measure, Score } from './ir.js';

function parseOk(source: string): Score {
	const { score, diagnostics } = parse(source);
	const errors = diagnostics.filter((d) => d.severity === 'error');
	expect(errors).toEqual([]);
	if (!score) throw new Error('expected a score');
	return score;
}

function measures(score: Score, track = 0, section = 0): Measure[] {
	return score.tracks[track]!.sections[section]!.items.filter((i): i is Measure => 'beats' in i);
}

describe('header directives', () => {
	it('parses metadata', () => {
		const score = parseOk(`@title "Song \\"X\\""
@artist "Me"
@album "Disc"
@tempo 132
@time 6/8
@key Am
@capo 2

@track G
@tuning E2 A2 D3 G3 B3 E4
a:
  | s6f0:8 s6f0 s6f0 s6f0 s6f0 s6f0 |
`);
		expect(score.metadata).toMatchObject({
			title: 'Song "X"',
			artist: 'Me',
			album: 'Disc',
			tempo: 132,
			time: { numerator: 6, denominator: 8 },
			key: 'Am',
			capo: 2,
		});
	});

	it('parses @arrange', () => {
		const score = parseOk(`@arrange intro verse intro

@track G
@tuning E2 A2 D3 G3 B3 E4
intro:
  | s6f0:4 s6f0 s6f0 s6f0 |
verse:
  | s6f0:4 s6f0 s6f0 s6f0 |
`);
		expect(score.arrange).toEqual(['intro', 'verse', 'intro']);
	});
});

describe('tracks & tuning', () => {
	it('derives string count and frets from a known instrument', () => {
		const score = parseOk(`@track Bass
@instrument bass
intro:
  | s4f0:4 s4f0 s4f0 s4f0 |
`);
		const t = score.tracks[0]!;
		expect(t.tuning).toEqual(['E1', 'A1', 'D2', 'G2']);
		expect(t.frets).toBe(24);
	});

	it('honors explicit @tuning and @frets overrides', () => {
		const score = parseOk(`@track G
@instrument guitar
@tuning D2 A2 D3 G3 B3 E4
@frets 22
a:
  | s6f0:4 s6f0 s6f0 s6f0 |
`);
		expect(score.tracks[0]!.tuning[0]).toBe('D2');
		expect(score.tracks[0]!.frets).toBe(22);
	});

	it('supports multiple tracks', () => {
		const score = parseOk(`@track G
@tuning E2 A2 D3 G3 B3 E4
a:
  | s6f0:4 s6f0 s6f0 s6f0 |

@track B
@tuning E1 A1 D2 G2
a:
  | s4f0:4 s4f0 s4f0 s4f0 |
`);
		expect(score.tracks.map((t) => t.name)).toEqual(['G', 'B']);
	});
});

describe('beats, chords, rests, durations', () => {
	const base = (body: string) => `@track G
@tuning E2 A2 D3 G3 B3 E4
a:
${body}
`;

	it('parses notes with durations', () => {
		const m = measures(parseOk(base('  | s6f3:4 s5f2:8 s5f2:8 s4f0:2 |')))[0]!;
		expect(m.beats.map((b) => b.duration)).toEqual([
			{ value: 4, dotted: false },
			{ value: 8, dotted: false },
			{ value: 8, dotted: false },
			{ value: 2, dotted: false },
		]);
	});

	it('carries duration over within a track', () => {
		const m = measures(parseOk(base('  | s6f0:8 s6f0 s6f0 s6f0 s6f0 s6f0 s6f0 s6f0 |')))[0]!;
		expect(m.beats.every((b) => b.duration.value === 8)).toBe(true);
	});

	it('parses dotted durations', () => {
		const m = measures(parseOk(base('  | s6f0:4. s6f0:8 s4f0:2 |')))[0]!;
		expect(m.beats[0]!.duration).toEqual({ value: 4, dotted: true });
	});

	it('parses chords', () => {
		const m = measures(parseOk(base('  | (s4f2 s3f2 s2f2):1 |')))[0]!;
		const beat = m.beats[0] as Extract<Beat, { kind: 'chord' }>;
		expect(beat.kind).toBe('chord');
		expect(beat.notes.map((n) => n.string)).toEqual([4, 3, 2]);
	});

	it('parses rests', () => {
		const m = measures(parseOk(base('  | s6f0:2 _:2 |')))[0]!;
		expect(m.beats[1]!.kind).toBe('rest');
	});

	it('parses tuplets', () => {
		const m = measures(parseOk(base('  | t3( s6f0:8 s6f2:8 s6f3:8 ) s6f0:4 s6f0:4 |')))[0]!;
		const beat = m.beats[0] as Extract<Beat, { kind: 'tuplet' }>;
		expect(beat.kind).toBe('tuplet');
		expect(beat.n).toBe(3);
		expect(beat.beats).toHaveLength(3);
	});
});

describe('repeats, voltas, nav markers', () => {
	const base = (body: string) => `@track G
@tuning E2 A2 D3 G3 B3 E4
a:
${body}
`;

	it('parses repeat open/close with count', () => {
		const ms = measures(parseOk(base('  |: s6f0:4 s6f0 s6f0 s6f0 :|x4')));
		expect(ms[0]!.repeatStart).toBe(true);
		expect(ms[0]!.repeatEnd).toEqual({ times: 4 });
	});

	it('defaults repeat count to 2', () => {
		const ms = measures(parseOk(base('  |: s6f0:4 s6f0 s6f0 s6f0 :|')));
		expect(ms[0]!.repeatEnd).toEqual({ times: 2 });
	});

	it('attaches voltas to the following measure', () => {
		const score = parseOk(
			base(
				'  |: s6f0:4 s6f0 s6f0 s6f0 |\n' +
					'[1] s6f0:4 s6f0 s6f0 s4f0 :|\n' +
					'[2] s6f0:4 s6f0 s6f0 s6f2 |',
			),
		);
		const ms = measures(score);
		expect(ms[0]!.repeatStart).toBe(true);
		expect(ms[1]!.volta).toEqual([1]);
		expect(ms[1]!.repeatEnd).toEqual({ times: 2 });
		expect(ms[2]!.volta).toEqual([2]);
	});

	it('parses navigation markers in order', () => {
		const score = parseOk(
			base('  @segno\n  | s6f0:4 s6f0 s6f0 s6f0 |\n  @coda\n  | s6f0:4 s6f0 s6f0 s6f0 |'),
		);
		const kinds = score.tracks[0]!.sections[0]!.items.map((i) =>
			'marker' in i ? `nav:${i.marker}` : 'measure',
		);
		expect(kinds).toEqual(['nav:segno', 'measure', 'nav:coda', 'measure']);
	});
});

describe('worked example fixture', () => {
	it('parses with no errors and validates clean', () => {
		const src = readFileSync(
			fileURLToPath(new URL('../../../fixtures/sunshine-riff.fd', import.meta.url)),
			'utf8',
		);
		const { score, diagnostics } = parse(src);
		expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
		expect(score?.tracks).toHaveLength(2);
		expect(score?.arrange).toEqual(['intro', 'verse']);
	});
});
