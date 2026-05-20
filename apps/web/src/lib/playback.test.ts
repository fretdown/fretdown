import { parse } from '@fretdown/core';
import { describe, expect, it } from 'vitest';
import { buildTimeline, channelFor } from './playback';

function scoreFrom(src: string) {
	const { score } = parse(src);
	if (!score) throw new Error('failed to parse');
	return score;
}

const GUITAR = `@title "T"
@tempo 120
@time 4/4
@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4
r:
  | s6f0:4 s5f2 s4f2 s3f0 |
`;

describe('buildTimeline', () => {
	it('computes bar timing from tempo and time signature', () => {
		const t = buildTimeline(scoreFrom(GUITAR));
		// 120 bpm, 4/4 → whole note = 2s, bar = 2s
		expect(t.barSeconds).toBeCloseTo(2);
		expect(t.measureCount).toBe(1);
		expect(t.duration).toBeCloseTo(2);
	});

	it('emits one event per beat with the right pitch and time', () => {
		const t = buildTimeline(scoreFrom(GUITAR));
		expect(t.events).toHaveLength(4);
		// s6f0 = open low E = MIDI 40, at time 0
		expect(t.events[0]).toMatchObject({ time: 0, notes: [40], channel: 0 });
		// quarter notes are 0.5s apart at 120 bpm
		expect(t.events[1]?.time).toBeCloseTo(0.5);
	});

	it('expands a hammer chain into sequential pitches within the beat', () => {
		const t = buildTimeline(scoreFrom('@track G\n@instrument guitar\nr:\n  | s3f5h7:4 s3f5:2 |\n'));
		// G3=55, fret 5 = 60 then fret 7 = 62, splitting the quarter note (0.25s each)
		expect(t.events[0]).toMatchObject({ notes: [60] });
		expect(t.events[1]).toMatchObject({ notes: [62] });
		expect(t.events[1]?.time).toBeCloseTo(0.25);
	});

	it('places each track on its own channel, skipping percussion (9)', () => {
		expect(channelFor(0)).toBe(0);
		expect(channelFor(9)).toBe(10);
	});

	it('solos a single track when onlyTrack is given', () => {
		const twoTracks = `@time 4/4
@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4
r:
  | s6f0:4 s5f2 s4f2 s3f0 |
@track Bass
@instrument bass
@tuning E1 A1 D2 G2
r:
  | s4f0:4 s4f0 s3f2 s3f0 |
`;
		const all = buildTimeline(scoreFrom(twoTracks));
		expect(new Set(all.events.map((e) => e.channel))).toEqual(new Set([0, 1]));

		const bassOnly = buildTimeline(scoreFrom(twoTracks), 1);
		expect(bassOnly.events.every((e) => e.channel === 1)).toBe(true);
		expect(bassOnly.events.length).toBeGreaterThan(0);
	});
});
