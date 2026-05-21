import {
	type Beat,
	type Measure,
	type Note,
	type Score,
	type Track,
	noteToMidi,
} from '@fretdown/core';

// Connectors that move to a new fret (a fresh attack). Bends/releases instead glide the
// current note via detune automation, so they sustain rather than re-articulate.
const TRANSITION_CONNECTORS = new Set(['h', 'p', '/', '\\']);
// Free FluidR3_GM samples served with CORS by jsDelivr.
const SAMPLE_BASE = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM';

/** A pitch-bend control point: how far (semitones) the note is bent `t` seconds after it starts. */
export interface BendPoint {
	t: number;
	semitones: number;
}

/** One scheduled sound: simultaneous MIDI pitches on a channel, with optional bend + velocity. */
export interface PlayEvent {
	channel: number;
	/** Seconds from the start of playback. */
	time: number;
	/** Seconds the notes are held. */
	duration: number;
	notes: number[];
	/** Note-on velocity (0–127); defaults to a normal pick. */
	velocity?: number;
	/** Per-note pitch bend / vibrato, applied to this voice's detune. */
	bend?: BendPoint[];
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

function trackForChannel(channel: number): number {
	return channel < 9 ? channel : channel - 1;
}

/**
 * Builds a flat, time-sorted schedule of note events (with per-note bends) from a score.
 * Pass `onlyTrack` to solo a single track; `tempoOverride` to play at a different bpm.
 */
export function buildTimeline(score: Score, onlyTrack?: number, tempoOverride?: number): Timeline {
	const bpm = tempoOverride ?? score.metadata.tempo ?? 120;
	const wholeNote = (4 * 60) / bpm; // a whole note is always four quarter notes
	const { numerator, denominator } = score.metadata.time;
	const barSeconds = (numerator / denominator) * wholeNote;

	const events: PlayEvent[] = [];
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

interface Segment {
	fret: number;
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

	// single note — transitions re-attack; bends/releases glide via detune.
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
		const duration = palmMuted ? Math.min(step, step * 0.4) : step;
		const event: PlayEvent = {
			channel,
			time: segStart,
			duration,
			notes: [openCapo + seg.fret],
			velocity: palmMuted ? 58 : undefined,
		};
		if (seg.bendFrets.length > 0) {
			event.bend = bendRamp([0, ...seg.bendFrets.map((f) => f - seg.fret)], step);
		} else if (vibrato) {
			event.bend = vibratoRamp(step);
		}
		out.push(event);
	});
	return start + total;
}

/** Bend control points (relative seconds) gliding through `points` semitones, then re-centering. */
function bendRamp(points: number[], step: number): BendPoint[] {
	const nodes = points.length;
	const portion = step * 0.85;
	const nodeTime = (i: number) => (nodes === 1 ? 0 : (i / (nodes - 1)) * portion);
	const out: BendPoint[] = [];
	for (let t = 0; t <= portion + 1e-9; t += 0.025) {
		let j = 0;
		while (j < nodes - 2 && t > nodeTime(j + 1)) j++;
		const t0 = nodeTime(j);
		const t1 = nodeTime(j + 1);
		const frac = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
		out.push({
			t,
			semitones: (points[j] as number) + ((points[j + 1] as number) - (points[j] as number)) * frac,
		});
	}
	out.push({ t: step, semitones: 0 });
	return out;
}

function vibratoRamp(step: number): BendPoint[] {
	const out: BendPoint[] = [];
	for (let t = 0; t <= step; t += 0.03)
		out.push({ t, semitones: 0.25 * Math.sin(2 * Math.PI * 5.5 * t) });
	out.push({ t: step, semitones: 0 });
	return out;
}

function powerOfTwoBelow(n: number): number {
	let p = 1;
	while (p * 2 < n) p *= 2;
	return p;
}

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** FluidR3 sample file name for a MIDI note (flats, e.g. 61 → "Db4"). */
function flatName(midi: number): string {
	return `${FLAT_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** A loaded set of pitch samples for one instrument, plus per-note playback with detune bends. */
class Soundfont {
	private buffers = new Map<number, AudioBuffer>();
	loaded = false;

	constructor(
		private ctx: AudioContext,
		private out: AudioNode,
	) {}

	/** Fetches every ~minor-third sample in [low, high]; `loaded` is true if enough decoded. */
	async load(folder: string, low: number, high: number): Promise<void> {
		const midis: number[] = [];
		for (let m = low; m <= high; m += 3) midis.push(m);
		await Promise.all(
			midis.map(async (m) => {
				try {
					const res = await fetch(`${SAMPLE_BASE}/${folder}-mp3/${flatName(m)}.mp3`);
					if (!res.ok) return;
					this.buffers.set(m, await this.ctx.decodeAudioData(await res.arrayBuffer()));
				} catch {
					/* a missing sample is fine — the nearest one is pitch-shifted to cover it */
				}
			}),
		);
		this.loaded = this.buffers.size >= 3;
	}

	private nearest(midi: number): number | null {
		let best: number | null = null;
		let dist = Number.POSITIVE_INFINITY;
		for (const m of this.buffers.keys()) {
			const d = Math.abs(m - midi);
			if (d < dist) {
				dist = d;
				best = m;
			}
		}
		return best;
	}

	play(midi: number, time: number, duration: number, gain: number, bend?: BendPoint[]): void {
		const sampleMidi = this.nearest(midi);
		if (sampleMidi === null) return;
		const src = this.ctx.createBufferSource();
		src.buffer = this.buffers.get(sampleMidi) as AudioBuffer;
		const baseCents = (midi - sampleMidi) * 100;
		src.detune.setValueAtTime(baseCents, time);
		if (bend)
			for (const p of bend)
				src.detune.linearRampToValueAtTime(baseCents + p.semitones * 100, time + p.t);
		applyEnvelope(this.ctx, src, this.out, time, duration, gain);
	}
}

/** Connects a source through a gain envelope and schedules start/stop. */
function applyEnvelope(
	ctx: AudioContext,
	src: AudioScheduledSourceNode,
	out: AudioNode,
	time: number,
	duration: number,
	peak: number,
): void {
	const env = ctx.createGain();
	const end = time + duration;
	env.gain.setValueAtTime(peak, time);
	env.gain.setValueAtTime(peak, Math.max(time, end - 0.04));
	env.gain.linearRampToValueAtTime(0.0001, end + 0.3); // short release tail
	src.connect(env).connect(out);
	src.start(time);
	src.stop(end + 0.35);
}

/** Oscillator fallback voice used when samples can't be fetched (keeps bends working). */
function playOsc(
	ctx: AudioContext,
	out: AudioNode,
	midi: number,
	time: number,
	duration: number,
	gain: number,
	bend?: BendPoint[],
): void {
	const osc = ctx.createOscillator();
	osc.type = 'sawtooth';
	osc.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
	osc.detune.setValueAtTime(0, time);
	if (bend) for (const p of bend) osc.detune.linearRampToValueAtTime(p.semitones * 100, time + p.t);
	const lp = ctx.createBiquadFilter();
	lp.type = 'lowpass';
	lp.frequency.value = 2600;
	applyEnvelope(ctx, osc, lp, time, duration, gain * 0.4);
	lp.connect(out);
}

/** Resolves the AudioContext constructor lazily (browser only — keeps this module Node-safe). */
function audioContextClass(): typeof AudioContext {
	// biome-ignore lint/suspicious/noExplicitAny: webkit-prefixed AudioContext fallback
	return window.AudioContext ?? (window as any).webkitAudioContext;
}

/**
 * Plays a {@link Timeline} through sampled instruments (free FluidR3_GM samples), with
 * per-note pitch bend / vibrato via detune. Falls back to a synth voice per channel whose
 * samples failed to load, so playback is never silent.
 */
export class TabPlayer {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private fonts = new Map<number, Soundfont | null>();
	private raf = 0;
	private startTime = 0;
	private idx = 0;
	private onTick?: (elapsed: number) => void;
	private onEnd?: () => void;

	/** `samples[trackIndex]` is the FluidR3_GM folder name for that track's instrument. */
	async play(
		timeline: Timeline,
		samples: string[],
		onTick: (elapsed: number) => void,
		onEnd: () => void,
	): Promise<void> {
		this.stop();
		if (!this.ctx) this.ctx = new (audioContextClass())();
		const ctx = this.ctx;
		if (ctx.state === 'suspended') await ctx.resume();
		const master = ctx.createGain();
		master.gain.value = 0.85;
		master.connect(ctx.destination);
		this.master = master;

		// Load a soundfont for each channel that actually plays.
		const usedChannels = [...new Set(timeline.events.map((e) => e.channel))];
		this.fonts = new Map();
		await Promise.all(
			usedChannels.map(async (channel) => {
				const folder = samples[trackForChannel(channel)] ?? 'acoustic_guitar_steel';
				const isBass = folder.includes('bass');
				const font = new Soundfont(ctx, master);
				await font.load(folder, isBass ? 28 : 40, isBass ? 67 : 88);
				this.fonts.set(channel, font.loaded ? font : null);
			}),
		);

		this.onTick = onTick;
		this.onEnd = onEnd;
		this.idx = 0;
		this.startTime = ctx.currentTime + 0.12;

		const loop = () => {
			const now = ctx.currentTime;
			const horizon = now + 0.2;
			while (
				this.idx < timeline.events.length &&
				this.startTime + (timeline.events[this.idx] as PlayEvent).time < horizon
			) {
				const e = timeline.events[this.idx++] as PlayEvent;
				const t = this.startTime + e.time;
				const gain = (e.velocity ?? 96) / 127;
				const font = this.fonts.get(e.channel);
				for (const midi of e.notes) {
					if (font) font.play(midi, t, e.duration, gain, e.bend);
					else playOsc(ctx, master, midi, t, e.duration, gain, e.bend);
				}
			}
			const elapsed = now - this.startTime;
			this.onTick?.(Math.max(0, elapsed));
			if (elapsed >= timeline.duration + 0.4) {
				this.finish();
				return;
			}
			this.raf = requestAnimationFrame(loop);
		};
		this.raf = requestAnimationFrame(loop);
	}

	get isPlaying(): boolean {
		return this.raf !== 0;
	}

	stop(): void {
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		// Muting the master silences everything already scheduled; the next play makes a new one.
		if (this.master) {
			this.master.gain.cancelScheduledValues(0);
			this.master.gain.value = 0;
		}
	}

	private finish(): void {
		this.stop();
		this.onEnd?.();
	}
}
