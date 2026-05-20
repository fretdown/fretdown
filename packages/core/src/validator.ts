import { getInstrument } from './instruments.js';
import type { Beat, Diagnostic, Measure, Note, Score, Track } from './ir.js';
import { isValidPitch } from './pitch.js';

const VALID_ARTICULATIONS = new Set([
	'pm',
	'vib',
	'harm',
	'ghost',
	'slap',
	'pop',
	'tap',
	'let',
	'stac',
]);

const EPSILON = 1e-6;

export function validate(score: Score): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];

	const sectionLabels = new Set<string>();
	for (const track of score.tracks) {
		for (const section of track.sections) sectionLabels.add(section.label);
	}

	if (score.arrange) {
		for (const label of score.arrange) {
			if (!sectionLabels.has(label)) {
				diagnostics.push({
					severity: 'error',
					code: 'arrange.unknownSection',
					message: `@arrange references section '${label}', which does not exist in any track`,
					location: { line: 0, col: 0, length: 0 },
				});
			}
		}
	}

	for (const track of score.tracks) validateTrack(track, score, diagnostics);
	return diagnostics;
}

function validateTrack(track: Track, score: Score, diagnostics: Diagnostic[]): void {
	if (track.instrument && !getInstrument(track.instrument)) {
		diagnostics.push({
			severity: 'warning',
			code: 'instrument.unknown',
			message: `Unknown instrument '${track.instrument}'; using defaults`,
			location: track.location,
		});
	}

	if (track.tuning.length === 0) {
		diagnostics.push({
			severity: 'error',
			code: 'track.noTuning',
			message: `Track '${track.name}' has no tuning; declare @tuning or a known @instrument`,
			location: track.location,
		});
	}

	for (const pitch of track.tuning) {
		if (!isValidPitch(pitch)) {
			diagnostics.push({
				severity: 'error',
				code: 'tuning.invalidPitch',
				message: `Invalid tuning pitch '${pitch}' (expected scientific pitch, e.g. E2, F#3)`,
				location: track.location,
			});
		}
	}

	const stringCount = track.tuning.length;
	const time = score.metadata.time;
	const expected = time.numerator / time.denominator;

	for (const section of track.sections) {
		for (const item of section.items) {
			if ('marker' in item) continue;
			validateMeasure(item, track, stringCount, expected, diagnostics);
		}
	}
}

function validateMeasure(
	measure: Measure,
	track: Track,
	stringCount: number,
	expected: number,
	diagnostics: Diagnostic[],
): void {
	let total = 0;
	for (const beat of measure.beats) {
		total += beatDuration(beat);
		validateBeat(beat, track, stringCount, diagnostics);
	}
	if (Math.abs(total - expected) > EPSILON) {
		diagnostics.push({
			severity: 'error',
			code: 'measure.duration',
			message: `Measure beats total ${formatFraction(total)} of a whole note but the time signature requires ${formatFraction(expected)}`,
			location: measure.location,
		});
	}
}

function validateBeat(
	beat: Beat,
	track: Track,
	stringCount: number,
	diagnostics: Diagnostic[],
): void {
	switch (beat.kind) {
		case 'note':
			validateNote(beat.note, track, stringCount, diagnostics);
			break;
		case 'chord':
			for (const note of beat.notes) validateNote(note, track, stringCount, diagnostics);
			break;
		case 'tuplet':
			for (const inner of beat.beats) validateBeat(inner, track, stringCount, diagnostics);
			break;
		case 'rest':
			break;
	}
}

function validateNote(
	note: Note,
	track: Track,
	stringCount: number,
	diagnostics: Diagnostic[],
): void {
	if (stringCount > 0 && (note.string < 1 || note.string > stringCount)) {
		diagnostics.push({
			severity: 'error',
			code: 'string.outOfRange',
			message: `String ${note.string} is out of range (track has ${stringCount} strings)`,
			location: note.location,
		});
	}

	const frets = [note.fret, ...note.events.map((e) => e.fret)].filter(
		(f): f is number => f !== null,
	);
	for (const fret of frets) {
		if (fret < 0 || fret > track.frets) {
			diagnostics.push({
				severity: 'error',
				code: 'fret.outOfRange',
				message: `Fret ${fret} is out of range (0–${track.frets})`,
				location: note.location,
			});
		}
	}

	for (const art of note.articulations) {
		if (!VALID_ARTICULATIONS.has(art)) {
			diagnostics.push({
				severity: 'error',
				code: 'articulation.unknown',
				message: `Unknown articulation '.${art}'`,
				location: note.location,
			});
		}
	}
}

/** Duration of a beat as a fraction of a whole note. */
export function beatDuration(beat: Beat): number {
	if (beat.kind === 'tuplet') {
		const faceTotal = beat.beats.reduce((sum, b) => sum + beatDuration(b), 0);
		const p = powerOfTwoBelow(beat.n);
		return faceTotal * (p / beat.n);
	}
	const base = 1 / beat.duration.value;
	return beat.duration.dotted ? base * 1.5 : base;
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}

function formatFraction(value: number): string {
	for (let den = 1; den <= 64; den *= 2) {
		const num = value * den;
		if (Math.abs(num - Math.round(num)) < EPSILON) return `${Math.round(num)}/${den}`;
	}
	return value.toFixed(4);
}
