import {
	type Beat,
	type Measure,
	type Note,
	type Score,
	type Track,
	noteToMidi,
} from '@fretdown/core';

// Connectors that move to a new fret (a fresh attack). Bends/releases instead glide the
// current note via MIDI pitch-bend, so they sustain rather than re-articulate.
const TRANSITION_CONNECTORS = new Set(['h', 'p', '/', '\\']);
// Pitch-bend range (± semitones) the synth is configured for; wide enough for big bends.
const BEND_RANGE = 12;

/** One scheduled sound: a set of simultaneous MIDI pitches on a channel at a time. */
export interface PlayEvent {
	channel: number;
	/** Seconds from the start of playback. */
	time: number;
	/** Seconds the notes are held. */
	duration: number;
	notes: number[];
	/** Note-on velocity (0–127); defaults to a normal pick. */
	velocity?: number;
}

/** A pitch-bend sample: how far (in semitones) a channel is bent at a given time. */
export interface BendEvent {
	channel: number;
	time: number;
	semitones: number;
}

export interface Timeline {
	events: PlayEvent[];
	bends: BendEvent[];
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

/**
 * Builds a flat, time-sorted schedule of note + pitch-bend events from a score. Pass
 * `onlyTrack` to solo a single track; `tempoOverride` to play at a different bpm.
 */
export function buildTimeline(score: Score, onlyTrack?: number, tempoOverride?: number): Timeline {
	const bpm = tempoOverride ?? score.metadata.tempo ?? 120;
	const wholeNote = (4 * 60) / bpm; // a whole note is always four quarter notes
	const { numerator, denominator } = score.metadata.time;
	const barSeconds = (numerator / denominator) * wholeNote;

	const events: PlayEvent[] = [];
	const bends: BendEvent[] = [];
	let measureCount = 0;

	score.tracks.forEach((track, trackIndex) => {
		if (onlyTrack !== undefined && trackIndex !== onlyTrack) return;
		const channel = channelFor(trackIndex);
		const measures = track.sections.flatMap((s) =>
			s.items.filter((it): it is Measure => 'beats' in it),
		);
		measureCount = Math.max(measureCount, measures.length);

		let cursor = 0;
		for (const measure of measures) {
			for (const beat of measure.beats) {
				cursor = collectBeat(track, beat, cursor, 1, channel, wholeNote, events, bends);
			}
		}
	});

	events.sort((a, b) => a.time - b.time);
	bends.sort((a, b) => a.time - b.time);
	return { events, bends, barSeconds, measureCount, duration: measureCount * barSeconds };
}

function secondsOf(value: number, dotted: boolean, scale: number, wholeNote: number): number {
	const base = (1 / value) * (dotted ? 1.5 : 1);
	return base * wholeNote * scale;
}

interface Segment {
	fret: number;
	/** Bend/release target frets decorating this attack. */
	bendFrets: number[];
}

/** Splits a note into attacks: transitions start a new one; bends/releases decorate it. */
function noteSegments(note: Note): Segment[] {
	const segs: Segment[] = [{ fret: note.fret ?? 0, bendFrets: [] }];
	for (const event of note.events) {
		if (TRANSITION_CONNECTORS.has(event.connector)) {
			segs.push({ fret: event.fret, bendFrets: [] });
		} else {
			(segs[segs.length - 1] as Segment).bendFrets.push(event.fret);
		}
	}
	return segs;
}

function collectBeat(
	track: Track,
	beat: Beat,
	start: number,
	scale: number,
	channel: number,
	wholeNote: number,
	out: PlayEvent[],
	bends: BendEvent[],
): number {
	if (beat.kind === 'rest') {
		return start + secondsOf(beat.duration.value, beat.duration.dotted, scale, wholeNote);
	}

	if (beat.kind === 'tuplet') {
		const inner = scale * (powerOfTwoBelow(beat.n) / beat.n);
		let c = start;
		for (const b of beat.beats) c = collectBeat(track, b, c, inner, channel, wholeNote, out, bends);
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

	// single note — transitions re-attack; bends/releases glide via pitch-bend.
	const note = beat.note;
	const base = noteToMidi(track, note);
	if (base === null) return start + total;
	if (note.dead) {
		// A muted/dead note is a short, soft percussive thunk on the (open) string.
		out.push({
			channel,
			time: start,
			duration: Math.min(total, 0.08),
			notes: [base],
			velocity: 42,
		});
		return start + total;
	}
	const openCapo = base - (note.fret ?? 0);
	const palmMuted = note.articulations.includes('pm');
	const vibrato = note.articulations.includes('vib');

	const segments = noteSegments(note);
	const step = total / segments.length;
	segments.forEach((seg, i) => {
		const segStart = start + i * step;
		// Palm-muted notes are shorter and softer (the percussive chunk).
		const duration = palmMuted ? Math.min(step, step * 0.4) : step;
		out.push({
			channel,
			time: segStart,
			duration,
			notes: [openCapo + seg.fret],
			velocity: palmMuted ? 58 : undefined,
		});
		if (seg.bendFrets.length > 0) {
			// Control points (semitones relative to the attack), starting at 0 (the picked pitch).
			const points = [0, ...seg.bendFrets.map((f) => f - seg.fret)];
			pushBendRamp(bends, channel, segStart, step, points);
		} else if (vibrato) {
			pushVibrato(bends, channel, segStart, step);
		}
	});
	return start + total;
}

/** Schedules a smooth pitch-bend gliding through `points` (semitones), then re-centers. */
function pushBendRamp(
	bends: BendEvent[],
	channel: number,
	segStart: number,
	step: number,
	points: number[],
): void {
	const nodes = points.length;
	const portion = step * 0.85; // reach the last target a bit before the note ends
	const nodeTime = (i: number) => (nodes === 1 ? 0 : (i / (nodes - 1)) * portion);
	const resolution = 0.025; // 25ms between bend samples for a smooth glide
	for (let t = 0; t <= portion + 1e-9; t += resolution) {
		let j = 0;
		while (j < nodes - 2 && t > nodeTime(j + 1)) j++;
		const t0 = nodeTime(j);
		const t1 = nodeTime(j + 1);
		const frac = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
		const semitones =
			(points[j] as number) + ((points[j + 1] as number) - (points[j] as number)) * frac;
		bends.push({ channel, time: segStart + t, semitones });
	}
	bends.push({ channel, time: segStart + step, semitones: 0 }); // re-center for the next note
}

/** Schedules a gentle pitch wobble over a note's duration, then re-centers (vibrato). */
function pushVibrato(bends: BendEvent[], channel: number, start: number, step: number): void {
	const rate = 5.5; // Hz
	const depth = 0.25; // semitones
	for (let t = 0; t <= step; t += 0.03) {
		bends.push({ channel, time: start + t, semitones: depth * Math.sin(2 * Math.PI * rate * t) });
	}
	bends.push({ channel, time: start + step, semitones: 0 });
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}

/** Converts semitones (within ±BEND_RANGE) to a 14-bit MIDI pitch-bend value. */
function bendValue(semitones: number): number {
	const v = Math.round(
		8192 + (Math.max(-BEND_RANGE, Math.min(BEND_RANGE, semitones)) / BEND_RANGE) * 8191,
	);
	return Math.max(0, Math.min(16383, v));
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
	private bendIdx = 0;
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
			const ch = channelFor(trackIndex);
			synth.send([0xc0 | ch, prog & 0x7f]);
			// Widen the pitch-bend range (RPN 0) so big bends are reachable.
			synth.send([0xb0 | ch, 101, 0]);
			synth.send([0xb0 | ch, 100, 0]);
			synth.send([0xb0 | ch, 6, BEND_RANGE]);
			synth.send([0xe0 | ch, 0, 64]); // center any leftover bend
		});

		this.timeline = timeline;
		this.onTick = onTick;
		this.onEnd = onEnd;
		this.idx = 0;
		this.bendIdx = 0;
		this.startTime = actx.currentTime + 0.15;

		const loop = () => {
			const ct = actx.currentTime;
			const horizon = ct + 0.2;
			while (
				this.idx < timeline.events.length &&
				this.startTime + (timeline.events[this.idx] as PlayEvent).time < horizon
			) {
				const e = timeline.events[this.idx++] as PlayEvent;
				const t = this.startTime + e.time;
				const off = t + Math.max(0.05, e.duration * 0.92);
				const velocity = e.velocity ?? 96;
				for (const n of e.notes) {
					synth.send([0x90 | e.channel, n, velocity], t);
					synth.send([0x80 | e.channel, n, 0], off);
				}
			}
			while (
				this.bendIdx < timeline.bends.length &&
				this.startTime + (timeline.bends[this.bendIdx] as BendEvent).time < horizon
			) {
				const b = timeline.bends[this.bendIdx++] as BendEvent;
				const value = bendValue(b.semitones);
				synth.send([0xe0 | b.channel, value & 0x7f, (value >> 7) & 0x7f], this.startTime + b.time);
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
				this.synth.send([0xe0 | ch, 0, 64]); // re-center pitch bend
			}
		}
	}

	private finish(): void {
		this.stop();
		this.onEnd?.();
	}
}
