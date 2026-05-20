import type { Beat, Duration, Note, Score, Track } from './ir.js';
import { parsePitch } from './pitch.js';

/** Pulses per quarter note. 480 keeps every supported duration (incl. triplets) integral. */
const PPQ = 480;
const TRANSITION_CONNECTORS = new Set(['h', 'p', '/', '\\']);

/**
 * Serializes a score to a Standard MIDI File (format 1): one conductor track carrying
 * tempo + time signature, then one track per instrument. Pitches come from the tuning
 * (open string + fret); hammer/pull/slide chains play their target frets sequentially
 * across the beat, mirroring the renderer. Deterministic — identical input, identical bytes.
 */
export function toMidi(score: Score): Uint8Array {
	const division = PPQ;
	const conductor = buildConductorTrack(score);
	const trackChunks = score.tracks.map((track, i) => buildTrackChunk(track, i));
	const ntrks = trackChunks.length + 1;

	const header = [
		...ascii('MThd'),
		...u32(6),
		...u16(1), // format 1
		...u16(ntrks),
		...u16(division),
	];
	return Uint8Array.from([...header, ...conductor, ...trackChunks.flat()]);
}

function buildConductorTrack(score: Score): number[] {
	const events: number[] = [];
	const bpm = score.metadata.tempo ?? 120;
	const usPerQuarter = Math.round(60_000_000 / bpm);
	// delta 0, FF 51 03 tttttt (set tempo)
	events.push(0, 0xff, 0x51, 0x03, ...u24(usPerQuarter));
	// delta 0, FF 58 04 nn dd cc bb (time signature)
	const { numerator, denominator } = score.metadata.time;
	events.push(0, 0xff, 0x58, 0x04, numerator, log2(denominator), 24, 8);
	events.push(0, 0xff, 0x2f, 0x00); // end of track
	return chunk('MTrk', events);
}

function buildTrackChunk(track: Track, index: number): number[] {
	const channel = index % 16;
	const program = /bass/i.test(track.instrument ?? '') ? 33 : 25; // GM: fingered bass / steel guitar
	const events: number[] = [];
	let lastTick = 0;
	let cursor = 0;

	const push = (tick: number, bytes: number[]): void => {
		events.push(...vlq(tick - lastTick), ...bytes);
		lastTick = tick;
	};
	const noteOn = (tick: number, midi: number) => push(tick, [0x90 | channel, midi, 80]);
	const noteOff = (tick: number, midi: number) => push(tick, [0x80 | channel, midi, 0]);

	push(0, [0xc0 | channel, program]); // program change

	const measures = track.sections.flatMap((s) => s.items.filter((i) => 'beats' in i));
	for (const measure of measures) {
		for (const beat of (measure as { beats: Beat[] }).beats) {
			cursor = emitBeat(beat, cursor, 1, track, noteOn, noteOff);
		}
	}

	push(cursor, [0xff, 0x2f, 0x00]); // end of track
	return chunk('MTrk', events);
}

/** Emits one beat's note events and returns the cursor (absolute ticks) after it. */
function emitBeat(
	beat: Beat,
	cursor: number,
	scale: number,
	track: Track,
	noteOn: (tick: number, midi: number) => void,
	noteOff: (tick: number, midi: number) => void,
): number {
	if (beat.kind === 'rest') return cursor + ticksOf(beat.duration, scale);

	if (beat.kind === 'tuplet') {
		const inner = scale * (powerOfTwoBelow(beat.n) / beat.n);
		let c = cursor;
		for (const b of beat.beats) c = emitBeat(b, c, inner, track, noteOn, noteOff);
		return c;
	}

	const total = ticksOf(beat.duration, scale);

	if (beat.kind === 'chord') {
		const pitches = beat.notes
			.map((n) => noteMidi(track, n))
			.filter((m): m is number => m !== null);
		for (const m of pitches) noteOn(cursor, m);
		for (const m of pitches) noteOff(cursor + total, m);
		return cursor + total;
	}

	// single note — possibly a hammer/pull/slide chain played sequentially across the beat.
	const segments = chainPitches(track, beat.note);
	if (segments.length === 0) return cursor + total; // dead/unpitched note: silent
	const step = total / segments.length;
	segments.forEach((midi, i) => {
		const start = Math.round(cursor + i * step);
		const end = Math.round(cursor + (i + 1) * step);
		noteOn(start, midi);
		noteOff(end, midi);
	});
	return cursor + total;
}

/** The sequence of MIDI pitches a single note plays: its fret, then any transition targets. */
function chainPitches(track: Track, note: Note): number[] {
	if (note.dead) return [];
	const base = noteMidi(track, note);
	if (base === null) return [];
	const open = base - (note.fret ?? 0);
	const pitches = [base];
	for (const event of note.events) {
		if (TRANSITION_CONNECTORS.has(event.connector)) pitches.push(open + event.fret);
	}
	return pitches;
}

function noteMidi(track: Track, note: Note): number | null {
	const idx = track.tuning.length - note.string;
	const open = track.tuning[idx];
	if (open === undefined) return null;
	const parsed = parsePitch(open);
	if (!parsed) return null;
	// A capo raises the sounding pitch; tab fret numbers stay relative to the capo.
	return parsed.midi + (note.fret ?? 0) + track.capo;
}

function ticksOf(duration: Duration, scale: number): number {
	const base = (4 * PPQ) / duration.value;
	return Math.round((duration.dotted ? base * 1.5 : base) * scale);
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}

function log2(n: number): number {
	return Math.round(Math.log2(n));
}

// --- byte helpers ---

function ascii(s: string): number[] {
	return [...s].map((c) => c.charCodeAt(0));
}

function u16(n: number): number[] {
	return [(n >> 8) & 0xff, n & 0xff];
}

function u24(n: number): number[] {
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function u32(n: number): number[] {
	return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Variable-length quantity (MIDI delta-time encoding). */
function vlq(value: number): number[] {
	let v = Math.max(0, Math.round(value));
	const bytes = [v & 0x7f];
	v = Math.floor(v / 128);
	while (v > 0) {
		bytes.unshift((v & 0x7f) | 0x80);
		v = Math.floor(v / 128);
	}
	return bytes;
}

function chunk(id: string, data: number[]): number[] {
	return [...ascii(id), ...u32(data.length), ...data];
}
