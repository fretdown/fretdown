import type { Beat, Duration, Measure, Note, Score, Section, Track } from './ir.js';

/** Serializes a Score back into canonical Fretdown text. Durations are always explicit. */
export function serialize(score: Score): string {
	const lines: string[] = [];
	const m = score.metadata;

	if (m.title) lines.push(`@title ${quote(m.title)}`);
	if (m.artist) lines.push(`@artist ${quote(m.artist)}`);
	if (m.album) lines.push(`@album ${quote(m.album)}`);
	if (m.tempo) lines.push(`@tempo ${m.tempo}`);
	lines.push(`@time ${m.time.numerator}/${m.time.denominator}`);
	if (m.key) lines.push(`@key ${m.key}`);
	if (m.capo) lines.push(`@capo ${m.capo}`);
	if (score.arrange && score.arrange.length > 0) lines.push(`@arrange ${score.arrange.join(' ')}`);

	for (const track of score.tracks) {
		lines.push('');
		serializeTrack(track, lines);
	}

	return `${lines.join('\n')}\n`;
}

function serializeTrack(track: Track, lines: string[]): void {
	lines.push(`@track ${needsQuote(track.name) ? quote(track.name) : track.name}`);
	if (track.instrument) lines.push(`@instrument ${track.instrument}`);
	if (track.tuning.length > 0) lines.push(`@tuning ${track.tuning.join(' ')}`);
	if (track.frets !== 24) lines.push(`@frets ${track.frets}`);
	if (track.capo) lines.push(`@capo ${track.capo}`);

	for (const section of track.sections) {
		lines.push('');
		serializeSection(section, lines);
	}
}

function serializeSection(section: Section, lines: string[]): void {
	lines.push(`${section.label}:`);
	for (const item of section.items) {
		if ('marker' in item) {
			lines.push(`  @${item.marker}`);
		} else {
			lines.push(`  ${serializeMeasure(item)}`);
		}
	}
}

function serializeMeasure(measure: Measure): string {
	const parts: string[] = [];
	if (measure.volta) parts.push(`[${measure.volta.join(',')}]`);
	parts.push(measure.repeatStart ? '|:' : '|');
	for (const beat of measure.beats) parts.push(serializeBeat(beat));
	if (measure.repeatEnd) {
		parts.push(measure.repeatEnd.times === 2 ? ':|' : `:|x${measure.repeatEnd.times}`);
	} else {
		parts.push('|');
	}
	return parts.join(' ');
}

function serializeBeat(beat: Beat): string {
	switch (beat.kind) {
		case 'note':
			return serializeNote(beat.note) + duration(beat.duration);
		case 'chord':
			return `(${beat.notes.map(serializeNote).join(' ')})${duration(beat.duration)}`;
		case 'rest':
			return `_${duration(beat.duration)}`;
		case 'tuplet':
			return `t${beat.n}( ${beat.beats.map(serializeBeat).join(' ')} )`;
	}
}

function serializeNote(note: Note): string {
	let out = `s${note.string}`;
	out += note.dead ? 'x' : `f${note.fret ?? 0}`;
	for (const ev of note.events) out += `${ev.connector}${ev.fret}`;
	for (const art of note.articulations) out += `.${art}`;
	return out;
}

function duration(d: Duration): string {
	return `:${d.value}${d.dotted ? '.' : ''}`;
}

function quote(text: string): string {
	return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function needsQuote(name: string): boolean {
	return !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name);
}
