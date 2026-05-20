import { describe, expect, it } from 'vitest';
import { isValidPitch, parsePitch } from './pitch.js';

describe('parsePitch', () => {
	it('parses naturals with octave', () => {
		expect(parsePitch('E2')).toMatchObject({ letter: 'E', accidental: null, octave: 2 });
		expect(parsePitch('A4')).toMatchObject({ letter: 'A', octave: 4 });
	});

	it('parses sharps and flats', () => {
		expect(parsePitch('F#3')).toMatchObject({ letter: 'F', accidental: '#', octave: 3 });
		expect(parsePitch('Bb1')).toMatchObject({ letter: 'B', accidental: 'b', octave: 1 });
	});

	it('computes MIDI numbers', () => {
		expect(parsePitch('C4')?.midi).toBe(60);
		expect(parsePitch('A4')?.midi).toBe(69);
		expect(parsePitch('E2')?.midi).toBe(40);
	});

	it('rejects malformed pitches', () => {
		expect(parsePitch('H2')).toBeNull();
		expect(parsePitch('Em')).toBeNull();
		expect(parsePitch('E')).toBeNull();
		expect(isValidPitch('X#9')).toBe(false);
	});
});
