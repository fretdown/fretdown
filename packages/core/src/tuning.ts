import type { Note, Track } from './ir.js';
import { parsePitch } from './pitch.js';

/**
 * The MIDI note number a fretted note sounds at, or `null` when the string index or the
 * track's tuning pitch is invalid. The tuning array is ordered low→high, so the highest
 * string number maps to `tuning[0]`; a capo raises the sounding pitch.
 */
export function noteToMidi(track: Track, note: Note): number | null {
	const idx = track.tuning.length - note.string;
	const open = track.tuning[idx];
	if (open === undefined) return null;
	const parsed = parsePitch(open);
	if (!parsed) return null;
	return parsed.midi + (note.fret ?? 0) + track.capo;
}
