import { describe, expect, it } from 'vitest';
import { type DecodedNote, decodeNoteAtom, isDecodeError } from './note-atom.js';

function ok(atom: string): DecodedNote {
	const result = decodeNoteAtom(atom);
	if (isDecodeError(result)) throw new Error(`expected ok, got error: ${result.error}`);
	return result;
}

describe('decodeNoteAtom', () => {
	it('decodes a plain note', () => {
		expect(ok('s6f3')).toEqual({
			string: 6,
			dead: false,
			fret: 3,
			events: [],
			articulations: [],
		});
	});

	it('decodes open string and multi-digit frets', () => {
		expect(ok('s1f0').fret).toBe(0);
		expect(ok('s3f12').fret).toBe(12);
	});

	it('decodes a dead note', () => {
		expect(ok('s6x')).toMatchObject({ string: 6, dead: true, fret: null });
	});

	it('decodes a hammer-on', () => {
		expect(ok('s3f5h7').events).toEqual([{ connector: 'h', fret: 7 }]);
	});

	it('decodes a pull-off', () => {
		expect(ok('s3f7p5').events).toEqual([{ connector: 'p', fret: 5 }]);
	});

	it('decodes slides up and down', () => {
		expect(ok('s1f0/3').events).toEqual([{ connector: '/', fret: 3 }]);
		expect(ok('s1f7\\5').events).toEqual([{ connector: '\\', fret: 5 }]);
	});

	it('decodes a bend with release', () => {
		expect(ok('s3f7b9r7').events).toEqual([
			{ connector: 'b', fret: 9 },
			{ connector: 'r', fret: 7 },
		]);
	});

	it('decodes a chain of connectors', () => {
		expect(ok('s3f5h7p5').events).toEqual([
			{ connector: 'h', fret: 7 },
			{ connector: 'p', fret: 5 },
		]);
	});

	it('decodes articulations', () => {
		expect(ok('s2f3.pm').articulations).toEqual(['pm']);
		expect(ok('s2f3.pm.vib').articulations).toEqual(['pm', 'vib']);
	});

	it('decodes connectors and articulations together', () => {
		const note = ok('s5f7h9.vib');
		expect(note.events).toEqual([{ connector: 'h', fret: 9 }]);
		expect(note.articulations).toEqual(['vib']);
	});

	it('rejects a dead note with connectors', () => {
		const result = decodeNoteAtom('s6xh7');
		expect(isDecodeError(result)).toBe(true);
	});

	it('rejects atoms not starting with s', () => {
		expect(isDecodeError(decodeNoteAtom('f3'))).toBe(true);
	});
});
