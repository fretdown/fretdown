import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import { toMidi } from './midi.js';

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

describe('toMidi', () => {
	it('emits a valid SMF header with one track per part plus a conductor track', () => {
		const bytes = toMidi(scoreFrom(GUITAR));
		const head = String.fromCharCode(...bytes.slice(0, 4));
		expect(head).toBe('MThd');
		// format 1, ntrks = 2 (conductor + one guitar), at bytes 8..12
		expect(bytes[9]).toBe(1); // format low byte
		expect(bytes[11]).toBe(2); // ntrks low byte
	});

	it('encodes the tempo from metadata in the conductor track', () => {
		const bytes = toMidi(scoreFrom(GUITAR));
		// 120 bpm → 500000 µs per quarter = 0x07A120
		const idx = indexOf(bytes, [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]);
		expect(idx).toBeGreaterThan(0);
	});

	it('maps open low-E (string 6, fret 0) to MIDI 40', () => {
		const bytes = toMidi(scoreFrom(GUITAR));
		// a note-on (0x90) for pitch 40 must appear in the guitar track
		const idx = indexOf(bytes, [0x90, 40]);
		expect(idx).toBeGreaterThan(0);
	});

	it('is deterministic', () => {
		const a = toMidi(scoreFrom(GUITAR));
		const b = toMidi(scoreFrom(GUITAR));
		expect(Array.from(a)).toEqual(Array.from(b));
	});

	it('renders the worked example without throwing', () => {
		const src = readFileSync(
			fileURLToPath(new URL('../../../fixtures/sunshine-riff.fd', import.meta.url)),
			'utf8',
		);
		const bytes = toMidi(scoreFrom(src));
		expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
		// guitar + bass + conductor = 3 tracks
		expect(bytes[11]).toBe(3);
	});

	it('plays hammer-chain target frets as distinct pitches', () => {
		const bytes = toMidi(scoreFrom('@track G\n@instrument guitar\nr:\n  | s3f5h7:4 s3f5:2 |\n'));
		// string 3 (G3=55) fret 5 = 60, fret 7 = 62 — both note-ons present
		expect(indexOf(bytes, [0x90, 60])).toBeGreaterThan(0);
		expect(indexOf(bytes, [0x90, 62])).toBeGreaterThan(0);
	});

	it('sounds the target of a bend (and release), not just the starting note', () => {
		// s3f5 bend up to fret 7, release back to 5 → 60, 62, 60 should all play
		const bytes = toMidi(scoreFrom('@track G\n@instrument guitar\nr:\n  | s3f5b7r5:4 s3f5:2 |\n'));
		expect(indexOf(bytes, [0x90, 60])).toBeGreaterThan(0);
		expect(indexOf(bytes, [0x90, 62])).toBeGreaterThan(0);
	});
});

function indexOf(haystack: Uint8Array, needle: number[]): number {
	for (let i = 0; i <= haystack.length - needle.length; i++) {
		let ok = true;
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) {
				ok = false;
				break;
			}
		}
		if (ok) return i;
	}
	return -1;
}
