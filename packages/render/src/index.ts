import type { Beat, Duration, Measure, Note, Score, Track } from '@fretdown/core';
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
	TabStave,
	Tuplet,
	Voice,
} from 'vexflow';
import { createContainer } from './dom.js';

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

const DURATION_CODE: Record<Duration['value'], string> = {
	1: 'w',
	2: 'h',
	4: 'q',
	8: '8',
	16: '16',
	32: '32',
};

export function renderToSVG(score: Score, options: RenderOptions = {}): string {
	const width = options.width ?? 900;
	const measuresPerLine = Math.max(1, options.measuresPerLine ?? 4);
	const scale = options.scale ?? 1;

	const container = createContainer();
	const renderer = new Renderer(container.element, Renderer.Backends.SVG);
	const ctx = renderer.getContext();

	// First pass: compute total height so we can size the canvas before drawing.
	const layout = planLayout(score, width, measuresPerLine);
	renderer.resize(Math.ceil(width * scale), Math.ceil(layout.totalHeight * scale));
	ctx.scale(scale, scale);

	drawHeader(ctx, score, width);

	for (const trackPlan of layout.tracks) {
		drawTrack(ctx, trackPlan);
	}

	return container.html();
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

function planLayout(score: Score, width: number, measuresPerLine: number): Layout {
	const tracks: TrackPlan[] = [];
	let y = TOP_PADDING;

	for (const track of score.tracks) {
		const numLines = Math.max(4, track.tuning.length || 6);
		const rowHeight = numLines * LINE_HEIGHT_PER_STRING + ROW_GAP + 12;
		const allMeasures = track.sections.flatMap((s) =>
			s.items.filter((i): i is Measure => 'beats' in i),
		);

		const labelY = y;
		y += 18;

		const measures: MeasurePlan[] = [];
		const usable = width - 2 * MARGIN;
		for (let i = 0; i < allMeasures.length; i += measuresPerLine) {
			const row = allMeasures.slice(i, i + measuresPerLine);
			const measureWidth = usable / row.length;
			row.forEach((measure, j) => {
				measures.push({
					measure,
					x: MARGIN + j * measureWidth,
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

function drawHeader(ctx: RenderContext, score: Score, width: number): void {
	const title = score.metadata.title ?? 'Untitled';
	ctx.save();
	ctx.setFont('Arial', 16, 'bold');
	ctx.fillText(title, MARGIN, 20);
	ctx.setFont('Arial', 11, '');
	const meta: string[] = [];
	if (score.metadata.artist) meta.push(score.metadata.artist);
	if (score.metadata.tempo) meta.push(`♩ = ${score.metadata.tempo}`);
	if (meta.length > 0) ctx.fillText(meta.join('   '), width - MARGIN - 200, 20);
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

		const { tickables, tuplets } = buildTickables(mp.measure);
		if (tickables.length === 0) continue;

		const voice = new Voice({ num_beats: plan.numerator, beat_value: plan.denominator })
			.setMode(Voice.Mode.SOFT)
			.addTickables(tickables);
		new Formatter().joinVoices([voice]).format([voice], mp.width - 24);
		voice.draw(ctx, stave);
		for (const tuplet of tuplets) tuplet.setContext(ctx).draw();
	}
}

function buildTickables(measure: Measure): { tickables: StemmableNote[]; tuplets: Tuplet[] } {
	const tickables: StemmableNote[] = [];
	const tuplets: Tuplet[] = [];
	for (const beat of measure.beats) {
		if (beat.kind === 'tuplet') {
			const inner = beat.beats.map((b) => beatToTickable(b));
			tickables.push(...inner);
			tuplets.push(
				new Tuplet(inner, { num_notes: beat.n, notes_occupied: powerOfTwoBelow(beat.n) }),
			);
		} else {
			tickables.push(beatToTickable(beat));
		}
	}
	return { tickables, tuplets };
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

function decorate(tabNote: TabNote, note: Note): void {
	const labels: string[] = [];
	for (const event of note.events) {
		if (event.connector === 'b') {
			const from = note.fret ?? 0;
			tabNote.addModifier(new Bend(bendText(event.fret - from)), 0);
		} else if (event.connector === 'r') {
			labels.push('rel');
		} else {
			labels.push(`${event.connector}${event.fret}`);
		}
	}
	if (note.articulations.length > 0) labels.push(...note.articulations);
	if (labels.length > 0) {
		tabNote.addModifier(new Annotation(labels.join(' ')).setVerticalJustification(3), 0);
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

export { createContainer } from './dom.js';
