import type { Beat, Duration, Measure, Note, Score, Track } from './ir.js';
import { parsePitch } from './pitch.js';
import { noteToMidi } from './tuning.js';

/** Divisions per quarter note. 24 = LCM(8, 3): exact for 32nd notes and eighth triplets. */
const DIVISIONS = 24;
const TRANSITION_CONNECTORS = new Set(['h', 'p', '/', '\\']);

const TYPE_NAME: Record<number, string> = {
	1: 'whole',
	2: 'half',
	4: 'quarter',
	8: 'eighth',
	16: '16th',
	32: '32nd',
};

// MIDI pitch class → [step, alter] using sharps.
const PITCH_CLASS: Array<[string, number]> = [
	['C', 0],
	['C', 1],
	['D', 0],
	['D', 1],
	['E', 0],
	['F', 0],
	['F', 1],
	['G', 0],
	['G', 1],
	['A', 0],
	['A', 1],
	['B', 0],
];

/**
 * Serializes a score to MusicXML 3.1 (score-partwise) with tab staff details: one part per
 * track, notes carrying both pitch (from tuning + fret) and `<string>`/`<fret>` technicals.
 * Hammer/pull/slide chains expand into slurred/slid notes that subdivide the beat — matching
 * the renderer — when the chain length is a power of two; otherwise the start note is emitted.
 */
export function toMusicXML(score: Score): string {
	const lines: string[] = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
		'<score-partwise version="3.1">',
		'  <work>',
		`    <work-title>${esc(score.metadata.title ?? 'Untitled')}</work-title>`,
		'  </work>',
		...identification(score),
		'  <part-list>',
	];

	score.tracks.forEach((track, i) => {
		lines.push(
			`    <score-part id="P${i + 1}">`,
			`      <part-name>${esc(track.name)}</part-name>`,
			'    </score-part>',
		);
	});
	lines.push('  </part-list>');

	score.tracks.forEach((track, i) => {
		lines.push(`  <part id="P${i + 1}">`);
		const measures = track.sections.flatMap((s) =>
			s.items.filter((it): it is Measure => 'beats' in it),
		);
		measures.forEach((measure, m) => {
			lines.push(...measureXml(score, track, measure, m));
		});
		if (measures.length === 0) lines.push(...emptyMeasure(score, track));
		lines.push('  </part>');
	});

	lines.push('</score-partwise>');
	return `${lines.join('\n')}\n`;
}

function identification(score: Score): string[] {
	if (!score.metadata.artist) return [];
	return [
		'  <identification>',
		`    <creator type="composer">${esc(score.metadata.artist)}</creator>`,
		'  </identification>',
	];
}

function measureXml(score: Score, track: Track, measure: Measure, index: number): string[] {
	const lines = [`    <measure number="${index + 1}">`];
	if (index === 0) lines.push(...attributes(score, track));
	if (measure.repeatStart) {
		lines.push(
			'      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>',
		);
	}
	for (const beat of measure.beats) lines.push(...beatXml(track, beat, 1));
	if (measure.repeatEnd) {
		lines.push(
			`      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward" times="${measure.repeatEnd.times}"/></barline>`,
		);
	}
	lines.push('    </measure>');
	return lines;
}

function emptyMeasure(score: Score, track: Track): string[] {
	return ['    <measure number="1">', ...attributes(score, track), '    </measure>'];
}

function attributes(score: Score, track: Track): string[] {
	const lines = [
		'      <attributes>',
		`        <divisions>${DIVISIONS}</divisions>`,
		'        <key><fifths>0</fifths></key>',
		`        <time><beats>${score.metadata.time.numerator}</beats><beat-type>${score.metadata.time.denominator}</beat-type></time>`,
		'        <clef><sign>TAB</sign><line>5</line></clef>',
		`        <staff-details><staff-lines>${track.tuning.length}</staff-lines>`,
	];
	// staff-tuning line 1 is the bottom line = lowest string = tuning[0].
	track.tuning.forEach((pitch, i) => {
		const p = parsePitch(pitch);
		if (!p) return;
		lines.push(
			`          <staff-tuning line="${i + 1}"><tuning-step>${p.letter}</tuning-step><tuning-octave>${p.octave}</tuning-octave></staff-tuning>`,
		);
	});
	lines.push('        </staff-details>', '      </attributes>');
	return lines;
}

function beatXml(track: Track, beat: Beat, scale: number): string[] {
	if (beat.kind === 'rest') {
		const dur = durationDivs(beat.duration, scale);
		return [
			'      <note>',
			'        <rest/>',
			`        <duration>${dur}</duration>`,
			`        <type>${TYPE_NAME[beat.duration.value]}</type>`,
			...(beat.duration.dotted ? ['        <dot/>'] : []),
			'      </note>',
		];
	}

	if (beat.kind === 'tuplet') {
		const inner = scale * (powerOfTwoBelow(beat.n) / beat.n);
		return beat.beats.flatMap((b) => beatXml(track, b, inner));
	}

	if (beat.kind === 'chord') {
		return beat.notes.flatMap((note, i) =>
			noteXml(track, note, beat.duration, scale, { chord: i > 0 }),
		);
	}

	// single note — expand a hammer/pull/slide chain when it subdivides evenly.
	const chain = chainNotes(track, beat.note, beat.duration);
	if (chain) return chain;
	return noteXml(track, beat.note, beat.duration, scale, {});
}

/** Expands a transition chain into subdivided, slurred/slid notes, or null if it can't. */
function chainNotes(track: Track, note: Note, duration: Duration): string[] | null {
	if (note.dead || duration.dotted || note.events.length === 0) return null;
	if (!note.events.every((e) => TRANSITION_CONNECTORS.has(e.connector))) return null;
	const count = note.events.length + 1;
	if ((count & (count - 1)) !== 0) return null;
	const subValue = duration.value * count;
	if (!(subValue in TYPE_NAME)) return null;

	const subDuration: Duration = { value: subValue as Duration['value'], dotted: false };
	const frets = [note.fret ?? 0, ...note.events.map((e) => e.fret)];
	const lines: string[] = [];
	frets.forEach((fret, i) => {
		const before = i > 0 ? note.events[i - 1]?.connector : undefined;
		const after = note.events[i]?.connector;
		const notations = chainNotations(before, after);
		const stepNote: Note = { ...note, fret, events: [], articulations: [] };
		lines.push(...noteXml(track, stepNote, subDuration, 1, { extraNotations: notations }));
	});
	return lines;
}

function chainNotations(before: string | undefined, after: string | undefined): string[] {
	const out: string[] = [];
	if (before === 'h' || before === 'p') out.push('          <slur type="stop" number="1"/>');
	else if (before === '/' || before === '\\') out.push('          <slide type="stop" number="1"/>');
	if (after === 'h' || after === 'p') out.push('          <slur type="start" number="1"/>');
	else if (after === '/' || after === '\\') out.push('          <slide type="start" number="1"/>');
	return out;
}

interface NoteOpts {
	chord?: boolean;
	extraNotations?: string[];
}

function noteXml(
	track: Track,
	note: Note,
	duration: Duration,
	scale: number,
	opts: NoteOpts,
): string[] {
	const midi = noteToMidi(track, note);
	const dur = durationDivs(duration, scale);
	const lines = ['      <note>'];
	if (opts.chord) lines.push('        <chord/>');

	if (note.dead || midi === null) {
		// A dead/unpitched note still occupies the beat — represent it as an unpitched note.
		lines.push('        <unpitched/>');
	} else {
		const octave = Math.floor(midi / 12) - 1;
		const entry = PITCH_CLASS[midi % 12];
		const [step, alter] = entry ?? ['C', 0];
		lines.push('        <pitch>', `          <step>${step}</step>`);
		if (alter !== 0) lines.push(`          <alter>${alter}</alter>`);
		lines.push(`          <octave>${octave}</octave>`, '        </pitch>');
	}

	lines.push(
		`        <duration>${dur}</duration>`,
		`        <type>${TYPE_NAME[duration.value]}</type>`,
	);
	if (duration.dotted) lines.push('        <dot/>');

	const technical: string[] = [];
	if (!note.dead && note.fret !== null) {
		technical.push(
			`          <string>${note.string}</string>`,
			`          <fret>${note.fret}</fret>`,
		);
	}
	const extra = opts.extraNotations ?? [];
	if (technical.length > 0 || extra.length > 0) {
		lines.push('        <notations>');
		lines.push(...extra);
		if (technical.length > 0) {
			lines.push('          <technical>', ...technical, '          </technical>');
		}
		lines.push('        </notations>');
	}

	lines.push('      </note>');
	return lines;
}

function durationDivs(duration: Duration, scale: number): number {
	const base = (4 * DIVISIONS) / duration.value;
	return Math.round((duration.dotted ? base * 1.5 : base) * scale);
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
