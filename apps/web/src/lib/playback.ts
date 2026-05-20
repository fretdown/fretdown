import {
	type Beat,
	type Measure,
	type Note,
	type Score,
	type Track,
	noteToMidi,
} from '@fretdown/core';

const TRANSITION_CONNECTORS = new Set(['h', 'p', '/', '\\']);

/** One scheduled sound: a set of simultaneous MIDI pitches on a channel at a time. */
export interface PlayEvent {
	channel: number;
	/** Seconds from the start of playback. */
	time: number;
	/** Seconds the notes are held. */
	duration: number;
	notes: number[];
}

export interface Timeline {
	events: PlayEvent[];
	/** Seconds per measure (one bar). Every measure has the same span. */
	barSeconds: number;
	/** Number of measures in the longest track. */
	measureCount: number;
	/** Total playback duration in seconds. */
	duration: number;
}

/** MIDI channel for a track index, skipping channel 9 (GM percussion). */
export function channelFor(trackIndex: number): number {
	return trackIndex < 9 ? trackIndex : trackIndex + 1;
}

/** Builds a flat, time-sorted schedule of note events from a score. */
export function buildTimeline(score: Score): Timeline {
	const bpm = score.metadata.tempo ?? 120;
	const wholeNote = (4 * 60) / bpm; // a whole note is always four quarter notes
	const { numerator, denominator } = score.metadata.time;
	const barSeconds = (numerator / denominator) * wholeNote;

	const events: PlayEvent[] = [];
	let measureCount = 0;

	score.tracks.forEach((track, trackIndex) => {
		const channel = channelFor(trackIndex);
		const measures = track.sections.flatMap((s) =>
			s.items.filter((it): it is Measure => 'beats' in it),
		);
		measureCount = Math.max(measureCount, measures.length);

		let cursor = 0;
		for (const measure of measures) {
			for (const beat of measure.beats) {
				cursor = collectBeat(track, beat, cursor, 1, channel, wholeNote, events);
			}
		}
	});

	events.sort((a, b) => a.time - b.time);
	return { events, barSeconds, measureCount, duration: measureCount * barSeconds };
}

function secondsOf(value: number, dotted: boolean, scale: number, wholeNote: number): number {
	const base = (1 / value) * (dotted ? 1.5 : 1);
	return base * wholeNote * scale;
}

function collectBeat(
	track: Track,
	beat: Beat,
	start: number,
	scale: number,
	channel: number,
	wholeNote: number,
	out: PlayEvent[],
): number {
	if (beat.kind === 'rest') {
		return start + secondsOf(beat.duration.value, beat.duration.dotted, scale, wholeNote);
	}

	if (beat.kind === 'tuplet') {
		const inner = scale * (powerOfTwoBelow(beat.n) / beat.n);
		let c = start;
		for (const b of beat.beats) c = collectBeat(track, b, c, inner, channel, wholeNote, out);
		return c;
	}

	const total = secondsOf(beat.duration.value, beat.duration.dotted, scale, wholeNote);

	if (beat.kind === 'chord') {
		const notes = beat.notes
			.map((n) => noteToMidi(track, n))
			.filter((m): m is number => m !== null);
		if (notes.length > 0) out.push({ channel, time: start, duration: total, notes });
		return start + total;
	}

	// single note — a hammer/pull/slide chain plays its targets in sequence.
	const segments = chainPitches(track, beat.note);
	if (segments.length > 0) {
		const step = total / segments.length;
		segments.forEach((midi, i) => {
			out.push({ channel, time: start + i * step, duration: step, notes: [midi] });
		});
	}
	return start + total;
}

function chainPitches(track: Track, note: Note): number[] {
	if (note.dead) return [];
	const base = noteToMidi(track, note);
	if (base === null) return [];
	const fret = note.fret ?? 0;
	const pitches = [base];
	for (const event of note.events) {
		if (TRANSITION_CONNECTORS.has(event.connector)) pitches.push(base + (event.fret - fret));
	}
	return pitches;
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}

// biome-ignore lint/suspicious/noExplicitAny: webaudio-tinysynth ships no types
type TinySynth = any;

/**
 * Plays a {@link Timeline} through a General MIDI synth (webaudio-tinysynth), using
 * look-ahead scheduling so {@link stop} can cancel notes that haven't sounded yet.
 */
export class TabPlayer {
	private synth: TinySynth = null;
	private raf = 0;
	private startTime = 0;
	private idx = 0;
	private timeline: Timeline | null = null;
	private onTick?: (elapsed: number) => void;
	private onEnd?: () => void;

	async play(
		timeline: Timeline,
		programs: number[],
		onTick: (elapsed: number) => void,
		onEnd: () => void,
	): Promise<void> {
		this.stop();
		if (!this.synth) {
			const mod = await import('webaudio-tinysynth');
			const Synth = ((mod as { default?: TinySynth }).default ?? mod) as new (
				opt: unknown,
			) => TinySynth;
			this.synth = new Synth({ voices: 64, useReverb: 1 });
		}
		const synth = this.synth;
		const actx = synth.getAudioContext();
		if (actx.state === 'suspended') await actx.resume();

		programs.forEach((prog, trackIndex) => {
			synth.send([0xc0 | channelFor(trackIndex), prog & 0x7f]);
		});

		this.timeline = timeline;
		this.onTick = onTick;
		this.onEnd = onEnd;
		this.idx = 0;
		this.startTime = actx.currentTime + 0.15;

		const loop = () => {
			const ct = actx.currentTime;
			const horizon = ct + 0.2;
			while (
				this.idx < timeline.events.length &&
				this.startTime + timeline.events[this.idx]!.time < horizon
			) {
				const e = timeline.events[this.idx++]!;
				const t = this.startTime + e.time;
				const off = t + Math.max(0.05, e.duration * 0.92);
				for (const n of e.notes) {
					synth.send([0x90 | e.channel, n, 96], t);
					synth.send([0x80 | e.channel, n, 0], off);
				}
			}
			const elapsed = ct - this.startTime;
			this.onTick?.(Math.max(0, elapsed));
			if (elapsed >= timeline.duration + 0.1) {
				this.finish();
				return;
			}
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
	}

	/** Live-swap the GM instrument for a track (takes effect immediately during playback). */
	setProgram(trackIndex: number, program: number): void {
		if (this.synth) this.synth.send([0xc0 | channelFor(trackIndex), program & 0x7f]);
	}

	get isPlaying(): boolean {
		return this.raf !== 0;
	}

	stop(): void {
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		if (this.synth) {
			for (let ch = 0; ch < 16; ch++) {
				this.synth.send([0xb0 | ch, 120, 0]); // all sound off
				this.synth.send([0xb0 | ch, 123, 0]); // all notes off
			}
		}
	}

	private finish(): void {
		this.stop();
		this.onEnd?.();
	}
}
