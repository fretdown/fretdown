import type { Beat, Duration, FretEvent, Measure, Note, Score, Track } from '@fretdown/core';
import {
	Annotation,
	Bend,
	Dot,
	Formatter,
	GhostNote,
	type RenderContext,
	Renderer,
	type StemmableNote,
	TabNote,
	TabSlide,
	TabStave,
	TabTie,
	Tuplet,
	Voice,
} from 'vexflow';

export interface RenderOptions {
	/** Total SVG width in pixels. */
	width?: number;
	/** Measures laid out per row. */
	measuresPerLine?: number;
	/** Uniform scale factor applied to the whole drawing. */
	scale?: number;
}

const MARGIN = 12;
const ROW_GAP = 16;
const TRACK_GAP = 28;
const LINE_HEIGHT_PER_STRING = 13;
const TOP_PADDING = 40;
// VexFlow's Stave reserves `space_above_staff_ln` (default 4) line-heights above the
// first line, so a TabStave drawn at y renders its top string at y + 4 line-heights.
const STAVE_TOP_OFFSET = 4 * LINE_HEIGHT_PER_STRING;
// Left gutter reserved for the per-string tuning labels at the start of each row.
const TUNING_GUTTER = 18;

const DURATION_CODE: Record<Duration['value'], string> = {
	1: 'w',
	2: 'h',
	4: 'q',
	8: '8',
	16: '16',
	32: '32',
};

/**
 * Renders a score into a DOM element using VexFlow's SVG backend. Works in any
 * environment that provides the element (a real DOM in the browser, or a jsdom
 * element in Node). Returns the rendered dimensions.
 */
export function renderInto(
	element: HTMLDivElement,
	score: Score,
	options: RenderOptions = {},
): { width: number; height: number } {
	const width = options.width ?? 900;
	const measuresPerLine = Math.max(1, options.measuresPerLine ?? 4);
	const scale = options.scale ?? 1;

	const renderer = new Renderer(element, Renderer.Backends.SVG);
	const ctx = renderer.getContext();

	// On narrow canvases, stack the artist/tempo under the title instead of to the right.
	const stackMeta = width < 600 && Boolean(score.metadata.artist || score.metadata.tempo);
	const headerTop = headerTopPadding(score, width);

	// First pass: compute total height so we can size the canvas before drawing.
	const layout = planLayout(score, width, measuresPerLine, headerTop);
	const pxWidth = Math.ceil(width * scale);
	const pxHeight = Math.ceil(layout.totalHeight * scale);
	renderer.resize(pxWidth, pxHeight);
	ctx.scale(scale, scale);

	drawHeader(ctx, score, width, stackMeta);
	for (const trackPlan of layout.tracks) {
		drawTrack(ctx, trackPlan);
	}

	return { width: pxWidth, height: pxHeight };
}

interface MeasurePlan {
	measure: Measure;
	x: number;
	y: number;
	width: number;
	isFirstInRow: boolean;
	showMeta: boolean;
}

interface TrackPlan {
	track: Track;
	labelY: number;
	numLines: number;
	measures: MeasurePlan[];
	numerator: number;
	denominator: number;
}

interface Layout {
	tracks: TrackPlan[];
	totalHeight: number;
}

function planLayout(
	score: Score,
	width: number,
	measuresPerLine: number,
	topPadding: number,
): Layout {
	const tracks: TrackPlan[] = [];
	let y = topPadding;

	for (const track of score.tracks) {
		const numLines = Math.max(4, track.tuning.length || 6);
		const rowHeight = numLines * LINE_HEIGHT_PER_STRING + ROW_GAP + 12;
		const allMeasures = track.sections.flatMap((s) =>
			s.items.filter((i): i is Measure => 'beats' in i),
		);

		const labelY = y;
		y += 18;

		const measures: MeasurePlan[] = [];
		const usable = width - 2 * MARGIN - TUNING_GUTTER;
		for (let i = 0; i < allMeasures.length; i += measuresPerLine) {
			const row = allMeasures.slice(i, i + measuresPerLine);
			const measureWidth = usable / row.length;
			row.forEach((measure, j) => {
				measures.push({
					measure,
					x: MARGIN + TUNING_GUTTER + j * measureWidth,
					y,
					width: measureWidth,
					isFirstInRow: j === 0,
					showMeta: i === 0 && j === 0,
				});
			});
			y += rowHeight;
		}
		if (allMeasures.length === 0) y += rowHeight;

		tracks.push({
			track,
			labelY,
			numLines,
			measures,
			numerator: score.metadata.time.numerator,
			denominator: score.metadata.time.denominator,
		});
		y += TRACK_GAP;
	}

	return { tracks, totalHeight: y + MARGIN };
}

/** A rendered measure's bounding box, in the SVG's coordinate space. */
export interface MeasureBox {
	/** Index of the track in `score.tracks`. */
	trackIndex: number;
	/** Index of the measure within its track. */
	measureIndex: number;
	x: number;
	y: number;
	width: number;
	height: number;
	/** X where notes begin (after the clef/time signature), for aligning a playback cursor. */
	noteX: number;
}

export interface ScoreLayout {
	width: number;
	height: number;
	measures: MeasureBox[];
}

/** Top offset where staves begin, leaving room for the header (which stacks on narrow widths). */
function headerTopPadding(score: Score, width: number): number {
	const hasMeta = Boolean(score.metadata.artist || score.metadata.tempo);
	return width < 600 && hasMeta ? 56 : TOP_PADDING;
}

/**
 * Computes the same measure layout {@link renderInto} draws, without rendering — so a host
 * (e.g. a playback cursor) can position overlays that line up with the produced SVG. Uses
 * identical defaults to {@link renderInto}; pass the same options you render with.
 */
export function computeLayout(score: Score, options: RenderOptions = {}): ScoreLayout {
	const width = options.width ?? 900;
	const measuresPerLine = Math.max(1, options.measuresPerLine ?? 4);
	const scale = options.scale ?? 1;
	const layout = planLayout(score, width, measuresPerLine, headerTopPadding(score, width));

	const measures: MeasureBox[] = [];
	layout.tracks.forEach((tp, trackIndex) => {
		const height = (tp.numLines - 1) * LINE_HEIGHT_PER_STRING;
		tp.measures.forEach((mp, measureIndex) => {
			// Mirror drawTrack's stave so getNoteStartX() matches the rendered note region.
			const stave = new TabStave(mp.x, mp.y, mp.width, { num_lines: tp.numLines });
			if (mp.isFirstInRow) stave.addClef('tab');
			if (mp.showMeta) stave.addTimeSignature(`${tp.numerator}/${tp.denominator}`);
			stave.format();
			measures.push({
				trackIndex,
				measureIndex,
				x: mp.x * scale,
				y: (mp.y + STAVE_TOP_OFFSET) * scale,
				width: mp.width * scale,
				height: height * scale,
				noteX: stave.getNoteStartX() * scale,
			});
		});
	});

	return {
		width: Math.ceil(width * scale),
		height: Math.ceil(layout.totalHeight * scale),
		measures,
	};
}

function drawHeader(ctx: RenderContext, score: Score, width: number, stackMeta: boolean): void {
	const title = score.metadata.title ?? 'Untitled';
	ctx.save();
	ctx.setFont('Arial', 16, 'bold');
	ctx.fillText(title, MARGIN, 20);
	ctx.setFont('Arial', 11, '');
	const meta: string[] = [];
	if (score.metadata.artist) meta.push(score.metadata.artist);
	if (score.metadata.tempo) meta.push(`♩ = ${score.metadata.tempo}`);
	if (meta.length > 0) {
		const text = meta.join('   ');
		if (stackMeta) ctx.fillText(text, MARGIN, 38);
		else ctx.fillText(text, width - MARGIN - 200, 20);
	}
	ctx.restore();
}

function drawTrack(ctx: RenderContext, plan: TrackPlan): void {
	ctx.save();
	ctx.setFont('Arial', 12, 'bold');
	ctx.fillText(plan.track.name, MARGIN, plan.labelY + 12);
	ctx.restore();

	for (const mp of plan.measures) {
		const stave = new TabStave(mp.x, mp.y, mp.width, { num_lines: plan.numLines });
		if (mp.isFirstInRow) stave.addClef('tab');
		if (mp.showMeta) stave.addTimeSignature(`${plan.numerator}/${plan.denominator}`);
		stave.setContext(ctx).draw();
		if (mp.isFirstInRow) drawTuningLabels(ctx, plan, mp);

		const { tickables, tuplets, connections } = buildTickables(mp.measure);
		if (tickables.length === 0) continue;

		const voice = new Voice({ num_beats: plan.numerator, beat_value: plan.denominator })
			.setMode(Voice.Mode.SOFT)
			.addTickables(tickables);
		new Formatter().joinVoices([voice]).format([voice], mp.width - 24);
		voice.draw(ctx, stave);
		for (const tuplet of tuplets) tuplet.setContext(ctx).draw();
		// Connections read note coordinates, so they're drawn after the voice is laid out.
		for (const c of connections) drawConnection(ctx, c);
	}
}

/**
 * Draws the open-string note letter for each line in the row's left gutter, top line first
 * (highest string). The tuning array is low→high, so line i reads `tuning[len - 1 - i]`.
 */
function drawTuningLabels(ctx: RenderContext, plan: TrackPlan, mp: MeasurePlan): void {
	const { tuning } = plan.track;
	ctx.save();
	ctx.setFont('Arial', 9, '');
	for (let i = 0; i < plan.numLines; i++) {
		const pitch = tuning[tuning.length - 1 - i];
		if (!pitch) continue;
		const letter = pitch.replace(/[-\d]/g, '');
		const y = mp.y + STAVE_TOP_OFFSET + i * LINE_HEIGHT_PER_STRING + 3;
		ctx.fillText(letter, MARGIN, y);
	}
	ctx.restore();
}

/** A technique that visually joins two adjacent tab notes (hammer, pull, slide). */
interface Connection {
	kind: 'hammer' | 'pull' | 'slide-up' | 'slide-down';
	first: TabNote;
	last: TabNote;
	/** Position index within the (chord) note to connect; defaults to the first position. */
	index?: number;
}

function drawConnection(ctx: RenderContext, c: Connection): void {
	const idx = [c.index ?? 0];
	const notes = { first_note: c.first, last_note: c.last, first_indices: idx, last_indices: idx };
	const tie =
		c.kind === 'hammer'
			? TabTie.createHammeron(notes)
			: c.kind === 'pull'
				? TabTie.createPulloff(notes)
				: c.kind === 'slide-up'
					? TabSlide.createSlideUp(notes)
					: TabSlide.createSlideDown(notes);
	tie.setContext(ctx).draw();
}

function buildTickables(measure: Measure): {
	tickables: StemmableNote[];
	tuplets: Tuplet[];
	connections: Connection[];
} {
	const tickables: StemmableNote[] = [];
	const tuplets: Tuplet[] = [];
	const connections: Connection[] = [];
	for (const beat of measure.beats) {
		if (beat.kind === 'tuplet') {
			// Chains aren't expanded inside tuplets — it would skew the tuplet's note count.
			const inner = beat.beats.map((b) => beatToTickable(b));
			tickables.push(...inner);
			tuplets.push(
				new Tuplet(inner, { num_notes: beat.n, notes_occupied: powerOfTwoBelow(beat.n) }),
			);
		} else {
			const expanded = expandBeat(beat);
			tickables.push(...expanded.tickables);
			connections.push(...expanded.connections);
			tuplets.push(...expanded.tuplets);
		}
	}
	return { tickables, tuplets, connections };
}

// Connectors that move to a new fret (a new notehead); bends/releases instead decorate the
// current notehead.
const TRANSITION_CONNECTORS = new Set(['h', 'p', '/', '\\']);

/** A notehead in a chain: a fret plus any bend/release events decorating it. */
interface ChainSegment {
	fret: number;
	bends: FretEvent[];
}

interface Subdivision {
	subDuration: Duration;
	occupied: number;
	isPow2: boolean;
}

/** How to split a beat into `count` equal chain noteheads (a tuplet when not a power of two). */
function chainSubdivision(count: number, duration: Duration): Subdivision | null {
	const isPow2 = (count & (count - 1)) === 0;
	const occupied = isPow2 ? count : powerOfTwoBelow(count);
	if (!isPow2 && duration.dotted) return null; // dotted + tuplet is out of scope
	const subValue = duration.value * occupied;
	if (!(subValue in DURATION_CODE)) return null; // would need a 64th note or smaller
	return {
		subDuration: { value: subValue as Duration['value'], dotted: isPow2 && duration.dotted },
		occupied,
		isPow2,
	};
}

/**
 * Expands a beat into the tickables (and joining connections) it draws as. A connector
 * chain like `s5f2h3` becomes two slurred noteheads (fret 2 → fret 3) sharing the beat's
 * duration; anything that doesn't qualify falls back to a single annotated note.
 */
function expandBeat(beat: Beat): {
	tickables: StemmableNote[];
	connections: Connection[];
	tuplets: Tuplet[];
} {
	if (beat.kind === 'note') {
		const chain = tryExpandChain(beat.note, beat.duration);
		if (chain) return chain;
	} else if (beat.kind === 'chord') {
		const chain = tryExpandChord(beat.notes, beat.duration);
		if (chain) return chain;
	}
	return { tickables: [beatToTickable(beat)], connections: [], tuplets: [] };
}

/**
 * Builds a chain of noteheads from a note's connectors: transitions (hammer/pull/slide)
 * each start a new notehead, while bends/releases decorate the current one. Returns null
 * when there's no transition (a plain or bend-only note — `decorate` handles those), the
 * note is dead, or the beat can't subdivide into a real note value (≤ 32nd). Power-of-two
 * chains subdivide evenly; an odd length (e.g. 3) is drawn as a tuplet (3 in the space of 2).
 */
function tryExpandChain(
	note: Note,
	duration: Duration,
): { tickables: StemmableNote[]; connections: Connection[]; tuplets: Tuplet[] } | null {
	if (note.dead) return null;

	const segments: ChainSegment[] = [{ fret: note.fret ?? 0, bends: [] }];
	const connectors: FretEvent['connector'][] = [];
	for (const event of note.events) {
		if (TRANSITION_CONNECTORS.has(event.connector)) {
			connectors.push(event.connector);
			segments.push({ fret: event.fret, bends: [] });
		} else {
			(segments[segments.length - 1] as ChainSegment).bends.push(event);
		}
	}

	const count = segments.length;
	if (count < 2) return null; // no transition → let decorate() draw the (possibly bent) note

	const sub = chainSubdivision(count, duration);
	if (!sub) return null;
	const { subDuration, occupied, isPow2 } = sub;
	const notes = segments.map(
		(seg) =>
			new TabNote({
				positions: [{ str: note.string, fret: String(seg.fret) }],
				duration: durationCode(subDuration),
			}),
	);
	if (subDuration.dotted) Dot.buildAndAttach(notes, { all: true });

	// Draw each notehead's bends as Bend arrows (a bend immediately released folds into one).
	segments.forEach((seg, idx) => {
		const tabNote = notes[idx];
		if (tabNote) addBendModifiers(tabNote, seg.fret, seg.bends);
	});

	const head = notes[0];
	if (head && note.articulations.length > 0) {
		head.addModifier(new Annotation(note.articulations.join(' ')).setVerticalJustification(1), 0);
	}

	const connections: Connection[] = [];
	connectors.forEach((connector, i) => {
		const from = (segments[i] as ChainSegment).fret;
		const to = (segments[i + 1] as ChainSegment).fret;
		// Slide direction follows the actual fret movement, not just the '/' vs '\' symbol.
		const kind: Connection['kind'] =
			connector === 'h'
				? 'hammer'
				: connector === 'p'
					? 'pull'
					: to >= from
						? 'slide-up'
						: 'slide-down';
		const first = notes[i];
		const last = notes[i + 1];
		if (first && last) connections.push({ kind, first, last });
	});

	const tickables = notes as unknown as StemmableNote[];
	const tuplets = isPow2
		? []
		: [new Tuplet(tickables, { num_notes: count, notes_occupied: occupied })];
	return { tickables, connections, tuplets };
}

/**
 * Expands a chord whose notes share a transition chain — e.g. `(s5f17\16 s6f15\14)` slides
 * down to `(s5f16 s6f14)`. Requires every note to have the same number of transition
 * connectors (no bends); otherwise returns null and the chord falls back to one annotated note.
 */
function tryExpandChord(
	notes: Note[],
	duration: Duration,
): { tickables: StemmableNote[]; connections: Connection[]; tuplets: Tuplet[] } | null {
	if (notes.length === 0 || notes.some((n) => n.dead)) return null;
	const events = notes[0]?.events.length ?? 0;
	if (events === 0) return null;
	if (!notes.every((n) => n.events.length === events)) return null;
	if (notes.some((n) => n.events.some((e) => !TRANSITION_CONNECTORS.has(e.connector)))) return null;

	const count = events + 1;
	const sub = chainSubdivision(count, duration);
	if (!sub) return null;
	const { subDuration, occupied, isPow2 } = sub;

	// The fret each note plays at step `s` (step 0 = its own fret, then each connector target).
	const fretAt = (n: Note, step: number) =>
		step === 0 ? (n.fret ?? 0) : (n.events[step - 1] as FretEvent).fret;

	const chordNotes = Array.from({ length: count }, (_, step) => {
		const positions = notes.map((n) => ({ str: n.string, fret: String(fretAt(n, step)) }));
		return new TabNote({ positions, duration: durationCode(subDuration) });
	});
	if (subDuration.dotted) Dot.buildAndAttach(chordNotes, { all: true });

	const connections: Connection[] = [];
	for (let step = 0; step < count - 1; step++) {
		const first = chordNotes[step];
		const last = chordNotes[step + 1];
		if (!first || !last) continue;
		notes.forEach((n, index) => {
			const event = n.events[step] as FretEvent;
			const from = fretAt(n, step);
			const to = event.fret;
			const kind: Connection['kind'] =
				event.connector === 'h'
					? 'hammer'
					: event.connector === 'p'
						? 'pull'
						: to >= from
							? 'slide-up'
							: 'slide-down';
			connections.push({ kind, first, last, index });
		});
	}

	const tickables = chordNotes as unknown as StemmableNote[];
	const tuplets = isPow2
		? []
		: [new Tuplet(tickables, { num_notes: count, notes_occupied: occupied })];
	return { tickables, connections, tuplets };
}

function beatToTickable(beat: Beat): StemmableNote {
	if (beat.kind === 'tuplet') {
		// Nested tuplets are flattened to their first inner beat for v1.
		return beatToTickable(beat.beats[0] ?? restOf(beat));
	}
	if (beat.kind === 'rest') {
		return new GhostNote(durationCode(beat.duration)) as unknown as StemmableNote;
	}

	const notes: Note[] = beat.kind === 'chord' ? beat.notes : [beat.note];
	const positions = notes.map((n) => ({
		str: n.string,
		fret: n.dead ? 'x' : String(n.fret ?? 0),
	}));
	const tabNote = new TabNote({ positions, duration: durationCode(beat.duration) });

	if (beat.duration.dotted) Dot.buildAndAttach([tabNote], { all: true });

	for (const note of notes) decorate(tabNote, note);
	return tabNote as unknown as StemmableNote;
}

/**
 * Adds Bend arrows for a note's bend/release events. Consecutive bends to the same fret are
 * collapsed (so `b11 b11` is one arrow, not "Full Full"), and a bend immediately followed by a
 * release folds into a single bend-and-return arrow.
 */
function addBendModifiers(tabNote: TabNote, fromFret: number, bendEvents: FretEvent[]): void {
	const events = bendEvents.filter(
		(e, i) => i === 0 || e.fret !== (bendEvents[i - 1] as FretEvent).fret,
	);
	for (let i = 0; i < events.length; i++) {
		const event = events[i] as FretEvent;
		if (event.connector === 'b') {
			const release = events[i + 1]?.connector === 'r';
			tabNote.addModifier(new Bend(bendText(event.fret - fromFret), release), 0);
			if (release) i++;
		} else if (event.connector === 'r') {
			tabNote.addModifier(new Annotation('rel').setVerticalJustification(1), 0);
		}
	}
}

function decorate(tabNote: TabNote, note: Note): void {
	const from = note.fret ?? 0;
	const bends = note.events.filter((e) => e.connector === 'b' || e.connector === 'r');
	addBendModifiers(tabNote, from, bends);

	// Any non-bend connectors (only reached on the chord fallback) become a small label.
	const labels = note.events
		.filter((e) => e.connector !== 'b' && e.connector !== 'r')
		.map((e) => `${e.connector}${e.fret}`);
	if (note.articulations.length > 0) labels.push(...note.articulations);
	if (labels.length > 0) {
		// TOP justification keeps technique text above the staff, not on the bottom string line.
		tabNote.addModifier(new Annotation(labels.join(' ')).setVerticalJustification(1), 0);
	}
}

function bendText(semitones: number): string {
	if (semitones <= 0) return '½';
	if (semitones === 1) return '½';
	if (semitones === 2) return 'Full';
	return `${semitones / 2}`;
}

function restOf(beat: Extract<Beat, { kind: 'tuplet' }>): Beat {
	return { kind: 'rest', duration: { value: 4, dotted: false }, location: beat.location };
}

function durationCode(duration: Duration): string {
	return DURATION_CODE[duration.value];
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}
