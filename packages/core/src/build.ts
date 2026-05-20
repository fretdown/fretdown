import { DEFAULT_FRETS, getInstrument } from './instruments.js';
import type {
	Beat,
	Diagnostic,
	Duration,
	Measure,
	NavMarker,
	Note,
	Score,
	Section,
	SectionItem,
	Track,
} from './ir.js';
import { decodeNoteAtom, isDecodeError } from './note-atom.js';
import type { MusicItem, RawBeat, RawDoc, RawNote, RawTrack } from './parser.js';

type PendingBeat =
	| { kind: 'note'; note: Note; duration: Duration | null; location: Note['location'] }
	| { kind: 'chord'; notes: Note[]; duration: Duration | null; location: Note['location'] }
	| { kind: 'rest'; duration: Duration | null; location: Note['location'] }
	| { kind: 'tuplet'; n: number; beats: PendingBeat[]; location: Note['location'] };

const DEFAULT_DURATION: Duration = { value: 4, dotted: false };

export function buildScore(doc: RawDoc, diagnostics: Diagnostic[]): Score {
	const time = doc.metadata.time ?? { numerator: 4, denominator: 4 };
	const tracks = doc.tracks.map((t) => buildTrack(t, diagnostics));
	return {
		metadata: {
			title: doc.metadata.title,
			artist: doc.metadata.artist,
			album: doc.metadata.album,
			tempo: doc.metadata.tempo,
			time,
			key: doc.metadata.key,
			capo: doc.metadata.capo ?? 0,
		},
		arrange: doc.arrange,
		tracks,
	};
}

function buildTrack(raw: RawTrack, diagnostics: Diagnostic[]): Track {
	const instrument = raw.instrument ? getInstrument(raw.instrument) : undefined;
	const tuning = raw.tuning.length > 0 ? raw.tuning : (instrument?.tuning ?? []);
	const frets = raw.frets ?? instrument?.frets ?? DEFAULT_FRETS;

	const carry: { duration: Duration } = { duration: DEFAULT_DURATION };
	const sections: Section[] = raw.sections.map((s) => {
		const items = assembleMeasures(s.items, diagnostics);
		const resolved = items.map((item) =>
			item.kind === 'nav' ? item : resolveMeasure(item, carry),
		);
		return { label: s.label, items: resolved, location: s.location };
	});

	return {
		name: raw.name,
		instrument: raw.instrument,
		tuning,
		frets,
		capo: raw.capo ?? 0,
		sections,
		location: raw.location,
	};
}

type PendingMeasure = {
	kind: 'measure';
	beats: PendingBeat[];
	volta?: number[];
	repeatStart?: boolean;
	repeatEnd?: { times: number };
	location: Note['location'];
};

type PendingItem = PendingMeasure | NavMarker;

/** Groups a flat list of music items into measures, attaching repeats and voltas. */
export function assembleMeasures(items: MusicItem[], diagnostics: Diagnostic[]): PendingItem[] {
	const out: PendingItem[] = [];
	let current: PendingBeat[] = [];
	let currentLoc: Note['location'] | null = null;
	let pendingRepeatStart = false;
	let pendingVolta: number[] | undefined;

	const flush = (repeatEnd?: { times: number }) => {
		if (current.length === 0) return;
		out.push({
			kind: 'measure',
			beats: current,
			volta: pendingVolta,
			repeatStart: pendingRepeatStart || undefined,
			repeatEnd,
			location: currentLoc ?? { line: 0, col: 0, length: 0 },
		});
		current = [];
		currentLoc = null;
		pendingRepeatStart = false;
		pendingVolta = undefined;
	};

	for (const item of items) {
		switch (item.type) {
			case 'beat': {
				const pb = toPendingBeat(item.beat, diagnostics);
				if (current.length === 0) currentLoc = item.beat.location;
				current.push(pb);
				break;
			}
			case 'bar':
				flush();
				break;
			case 'repeatOpen':
				flush();
				pendingRepeatStart = true;
				break;
			case 'repeatClose':
				flush({ times: item.times });
				break;
			case 'volta':
				if (current.length > 0) flush();
				pendingVolta = item.numbers;
				break;
			case 'nav':
				if (current.length > 0) flush();
				out.push({ kind: 'nav', marker: item.marker, location: item.location });
				break;
		}
	}
	flush();
	return out;
}

function toPendingBeat(raw: RawBeat, diagnostics: Diagnostic[]): PendingBeat {
	switch (raw.kind) {
		case 'note':
			return {
				kind: 'note',
				note: decode(raw.atom, raw.location, diagnostics),
				duration: raw.duration,
				location: raw.location,
			};
		case 'chord':
			return {
				kind: 'chord',
				notes: raw.notes.map((n: RawNote) => decode(n.atom, n.location, diagnostics)),
				duration: raw.duration,
				location: raw.location,
			};
		case 'rest':
			return { kind: 'rest', duration: raw.duration, location: raw.location };
		case 'tuplet':
			return {
				kind: 'tuplet',
				n: raw.n,
				beats: raw.beats.map((b) => toPendingBeat(b, diagnostics)),
				location: raw.location,
			};
	}
}

function decode(atom: string, location: Note['location'], diagnostics: Diagnostic[]): Note {
	const result = decodeNoteAtom(atom);
	if (isDecodeError(result)) {
		diagnostics.push({
			severity: 'error',
			code: 'note.malformed',
			message: `Malformed note '${atom}': ${result.error}`,
			location: { ...location, col: location.col + result.offset, length: 1 },
		});
		return { string: 0, dead: true, fret: null, events: [], articulations: [], location };
	}
	return { ...result, location };
}

function resolveMeasure(m: PendingMeasure, carry: { duration: Duration }): Measure {
	const beats = m.beats.map((b) => resolveBeat(b, carry));
	return {
		beats,
		volta: m.volta,
		repeatStart: m.repeatStart,
		repeatEnd: m.repeatEnd,
		location: m.location,
	};
}

function resolveBeat(b: PendingBeat, carry: { duration: Duration }): Beat {
	if (b.kind === 'tuplet') {
		const beats = b.beats.map((inner) => resolveBeat(inner, carry));
		return { kind: 'tuplet', n: b.n, beats, location: b.location };
	}
	const duration = b.duration ?? carry.duration;
	carry.duration = duration;
	if (b.kind === 'note') return { kind: 'note', note: b.note, duration, location: b.location };
	if (b.kind === 'chord') return { kind: 'chord', notes: b.notes, duration, location: b.location };
	return { kind: 'rest', duration, location: b.location };
}
