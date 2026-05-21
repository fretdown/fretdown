import type { Beat, Connector, Duration, Note, Score } from './ir.js';
import { serialize } from './serialize.js';

export interface AsciiResult {
	score: Score | null;
	fretdown: string | null;
	confidence: number;
	ambiguities: string[];
}

const INSTRUMENT_BY_STRINGS: Record<number, { instrument: string; tuning: string[] }> = {
	4: { instrument: 'bass', tuning: ['E1', 'A1', 'D2', 'G2'] },
	5: { instrument: 'bass5', tuning: ['B0', 'E1', 'A1', 'D2', 'G2'] },
	6: { instrument: 'guitar', tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
	7: { instrument: 'guitar7', tuning: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
};

const CONNECTOR_CHARS = new Set(['h', 'p', 'b', 'r', '/', '\\']);

interface LineToken {
	col: number;
	fret: number | null; // null = dead note
	connector: Connector | null;
	/** Connector/`~` chars after the fret with no target (e.g. `12\`, `3b`, `3~`). */
	trailing?: string[];
}

/** Best-effort conversion of legacy ASCII tab into a partial Fretdown score. */
export function parseAsciiTab(text: string): AsciiResult {
	const ambiguities: string[] = [];
	const rawLines = text.split('\n');

	const blocks = findTabBlocks(rawLines);
	if (blocks.length === 0) {
		return { score: null, fretdown: null, confidence: 0, ambiguities: ['no-tab-block-found'] };
	}

	// The most common block size is the string count; odd-sized blocks are skipped.
	const stringCount = mode(blocks.map((b) => b.lines.length));
	const systems = blocks.filter((b) => b.lines.length === stringCount);
	if (systems.length > 1) ambiguities.push('multi-system');

	const tuningInfo = INSTRUMENT_BY_STRINGS[stringCount];
	if (!tuningInfo) ambiguities.push('unusual-string-count');
	ambiguities.push('rhythm-approximated', 'tuning-guessed');

	// Each system becomes its own bars and keeps its own palm mutes and repeat count.
	type Item = Score['tracks'][number]['sections'][number]['items'][number];
	const items: Item[] = [];
	let hasTechniques = false;
	let hasRepeat = false;

	for (const block of systems) {
		const group = block.lines;
		const firstBar = (group[0] as string).indexOf('|');
		const pmCols = palmMuteColumns(rawLines, block.start, firstBar);
		const perString = trimBodies(group).map((body) => {
			const tokens = tokenizeLine(body);
			if (tokens.some((t) => t.connector || t.trailing?.length)) hasTechniques = true;
			return tokens;
		});
		if (pmCols.length > 0) hasTechniques = true;

		const measures = layoutBars(systemEvents(perString, stringCount, pmCols), 8);
		const times = detectRepeat(group);
		if (times && measures.length > 0) {
			(measures[0] as { repeatStart?: boolean }).repeatStart = true;
			(measures[measures.length - 1] as { repeatEnd?: { times: number } }).repeatEnd = { times };
			hasRepeat = true;
		}
		items.push(...measures);
	}
	if (hasTechniques) ambiguities.push('techniques-approximated');
	if (hasRepeat) ambiguities.push('repeat-detected');

	const score: Score = {
		metadata: { time: { numerator: 4, denominator: 4 }, capo: 0 },
		tracks: [
			{
				name: stringCount <= 4 ? 'Bass' : 'Guitar',
				instrument: tuningInfo?.instrument,
				tuning: tuningInfo?.tuning ?? Array.from({ length: stringCount }, () => 'E2'),
				frets: 24,
				capo: 0,
				sections: [{ label: 'tab', items, location: zero() }],
				location: zero(),
			},
		],
	};

	let confidence = 0.8;
	if (!tuningInfo) confidence -= 0.2;
	if (hasTechniques) confidence -= 0.1;
	confidence = Math.max(0.1, Math.min(0.9, confidence));

	return { score, fretdown: serialize(score), confidence, ambiguities };
}

interface TabBlock {
	lines: string[];
	/** Index in the original lines where this block starts (for finding a P.M. line above it). */
	start: number;
}

/** Finds every group of consecutive tab lines (each a "system"); blank/prose lines separate. */
function findTabBlocks(lines: string[]): TabBlock[] {
	const blocks: TabBlock[] = [];
	let current: string[] = [];
	let start = 0;
	const flush = (end: number) => {
		if (current.length >= 2) blocks.push({ lines: current, start: end - current.length });
		current = [];
	};
	lines.forEach((line, i) => {
		if (isTabLine(line)) {
			if (current.length === 0) start = i;
			current.push(line);
		} else {
			flush(i);
		}
	});
	flush(lines.length);
	return blocks;
}

/** A line of palm-mute dots/PM markers above a system (e.g. "  .  .  .   .  ."). */
function isPalmMuteLine(line: string): boolean {
	return !isTabLine(line) && !/[0-9]/.test(line) && (line.match(/\./g)?.length ?? 0) >= 2;
}

/**
 * Body columns marked by a palm-mute dots line just above a block, or [] if there isn't one.
 * Dots are mapped from raw columns into the block's bar-relative body coordinates.
 */
function palmMuteColumns(lines: string[], blockStart: number, firstBar: number): number[] {
	for (const above of [blockStart - 1, blockStart - 2]) {
		const line = lines[above];
		if (line === undefined) continue;
		if (isPalmMuteLine(line)) {
			return [...line.matchAll(/\./g)].map((m) => (m.index ?? 0) - firstBar).filter((c) => c >= 0);
		}
		if (line.trim() !== '') break; // a non-blank, non-PM line (e.g. a label) stops the search
	}
	return [];
}

/** The most frequent value (used to pick the dominant string count across systems). */
function mode(nums: number[]): number {
	const counts = new Map<number, number>();
	let best = nums[0] ?? 6;
	let bestCount = 0;
	for (const n of nums) {
		const c = (counts.get(n) ?? 0) + 1;
		counts.set(n, c);
		if (c > bestCount) {
			bestCount = c;
			best = n;
		}
	}
	return best;
}

/** Keeps only the bar-delimited region of each line (first '|' to last '|'), dropping the
 * string label and any trailing annotation like "(6x)" that would be misread as notes. */
function trimBodies(group: string[]): string[] {
	return group.map((line) => {
		const first = line.indexOf('|');
		if (first < 0) return line;
		const last = line.lastIndexOf('|');
		return last > first ? line.slice(first, last + 1) : line.slice(first);
	});
}

function isTabLine(line: string): boolean {
	if (!line.includes('|') && !line.includes('-')) return false;
	const dashes = (line.match(/-/g) ?? []).length;
	return dashes >= 3;
}

function tokenizeLine(body: string): LineToken[] {
	const tokens: LineToken[] = [];
	for (let i = 0; i < body.length; i++) {
		const ch = body[i] as string;
		if (ch >= '0' && ch <= '9') {
			const start = i;
			let num = '';
			let d = body[i];
			while (d !== undefined && d >= '0' && d <= '9') {
				num += d;
				i++;
				d = body[i];
			}
			i--;
			const prev = body[start - 1];
			const connector = prev && CONNECTOR_CHARS.has(prev) ? (prev as Connector) : null;
			tokens.push({ col: start, fret: Number(num), connector });
		} else if (ch === 'x' || ch === 'X') {
			tokens.push({ col: i, fret: null, connector: null });
		} else if (ch === '~' || CONNECTOR_CHARS.has(ch)) {
			// A connector/`~` with no fret after it is a trailing modifier on the previous note
			// (e.g. `12\` slide-off, `3b` bend, `3~` vibrato). If a digit follows, it's that
			// note's leading connector instead, handled above.
			const next = body[i + 1];
			const followedByDigit = next !== undefined && next >= '0' && next <= '9';
			const last = tokens[tokens.length - 1];
			if (!followedByDigit && last) {
				last.trailing ??= [];
				last.trailing.push(ch);
			}
		}
	}
	return tokens;
}

/** Detects a repeat count from a trailing annotation like "(6x)" or "x6" after the bar. */
function detectRepeat(lines: string[]): number | null {
	for (const line of lines) {
		const first = line.indexOf('|');
		const last = line.lastIndexOf('|');
		if (last <= first) continue; // only text after a genuine closing barline
		const trailing = line.slice(last + 1);
		const m = trailing.match(/(\d+)\s*x/i) ?? trailing.match(/x\s*(\d+)/i);
		if (m) {
			const n = Number(m[1]);
			if (n >= 2 && n <= 99) return n;
		}
	}
	return null;
}

// Representable durations in eighth-note units, largest first (whole … eighth).
const DURATION_UNITS: { units: number; value: Duration['value']; dotted: boolean }[] = [
	{ units: 8, value: 1, dotted: false },
	{ units: 6, value: 2, dotted: true },
	{ units: 4, value: 2, dotted: false },
	{ units: 3, value: 4, dotted: true },
	{ units: 2, value: 4, dotted: false },
	{ units: 1, value: 8, dotted: false },
];

/** Greedily expresses N eighth-note units as standard durations (e.g. 5 → half + eighth). */
function durationsForUnits(units: number): Duration[] {
	const out: Duration[] = [];
	let n = units;
	while (n > 0) {
		const d = DURATION_UNITS.find((x) => x.units <= n) ?? {
			units: 1,
			value: 8 as const,
			dotted: false,
		};
		out.push({ value: d.value, dotted: d.dotted });
		n -= d.units;
	}
	return out;
}

/** A single note/chord onset: how long it's held (in eighth units) and how to build its beat. */
interface Onset {
	units: number;
	build: (duration: Duration) => Beat;
}

/** Turns trailing connectors/`~` into events + articulations on a note (e.g. `12\`, `3b`, `3~`). */
function applyTrailing(note: Note, trailing: string[]): void {
	const fret = note.fret ?? 0;
	for (const m of trailing) {
		if (m === '~') {
			if (!note.articulations.includes('vib')) note.articulations.push('vib');
		} else if (m === 'b') {
			note.events.push({ connector: 'b', fret: fret + 2 }); // default a full bend up
		} else if (m === '/') {
			note.events.push({ connector: '/', fret: fret + 2 });
		} else if (m === '\\') {
			note.events.push({ connector: '\\', fret: Math.max(0, fret - 2) }); // slide off, downward
		}
	}
}

/** Turns one system's tokens into ordered onsets, inferring each note's length from spacing. */
function systemEvents(perString: LineToken[][], stringCount: number, pmCols: number[]): Onset[] {
	// Attach connector tokens to the previous note on the same string; collect notes by column.
	const noteByStringCol = new Map<string, Note>();
	const colSet = new Set<number>();
	const isPalmMuted = (col: number) => pmCols.some((c) => Math.abs(c - col) <= 1);

	perString.forEach((tokens, lineIdx) => {
		const stringNumber = lineIdx + 1; // top line = string 1
		let lastNote: Note | null = null;
		for (const t of tokens) {
			if (t.connector && lastNote) {
				lastNote.events.push({ connector: t.connector, fret: t.fret ?? 0 });
				if (t.trailing) applyTrailing(lastNote, t.trailing);
				continue;
			}
			const note: Note = {
				string: stringNumber,
				dead: t.fret === null,
				fret: t.fret,
				events: [],
				articulations: isPalmMuted(t.col) ? ['pm'] : [],
				location: zero(),
			};
			if (t.trailing) applyTrailing(note, t.trailing);
			noteByStringCol.set(`${t.col}:${stringNumber}`, note);
			colSet.add(t.col);
			lastNote = note;
		}
	});

	const cols = [...colSet].sort((a, b) => a - b);
	if (cols.length === 0) return [];

	const makeBeat = (c: number, duration: Duration): Beat => {
		const notes: Note[] = [];
		for (let str = 1; str <= stringCount; str++) {
			const n = noteByStringCol.get(`${c}:${str}`);
			if (n) notes.push(n);
		}
		if (notes.length === 1) {
			return { kind: 'note', note: notes[0] as Note, duration, location: zero() };
		}
		return { kind: 'chord', notes, duration, location: zero() };
	};

	// Infer rhythm from horizontal spacing: the tightest gap between notes is one eighth, and a
	// note is held until the next note starts, so wider gaps become longer notes.
	const gaps: number[] = [];
	for (let i = 0; i < cols.length - 1; i++) {
		gaps.push((cols[i + 1] as number) - (cols[i] as number));
	}
	const unit = gaps.length > 0 ? Math.max(1, Math.min(...gaps)) : 1;
	return cols.map((c, i) => ({
		units:
			i < cols.length - 1
				? Math.max(1, Math.min(8, Math.round(((cols[i + 1] as number) - c) / unit)))
				: 1,
		build: (duration: Duration) => makeBeat(c, duration),
	}));
}

/** Lays a stream of held onsets onto bars, splitting across barlines and rest-padding the last. */
function layoutBars(
	onsets: Onset[],
	eighthsPerBar: number,
): Score['tracks'][number]['sections'][number]['items'] {
	const items: ReturnType<typeof layoutBars> = [];
	let beats: Beat[] = [];
	let remaining = eighthsPerBar;
	const closeBar = () => {
		items.push({ beats, location: zero() });
		beats = [];
		remaining = eighthsPerBar;
	};

	for (const onset of onsets) {
		let units = onset.units;
		while (units > 0) {
			if (remaining === 0) closeBar();
			const take = Math.min(units, remaining);
			for (const duration of durationsForUnits(take)) beats.push(onset.build(duration));
			units -= take;
			remaining -= take;
		}
	}
	if (beats.length > 0) {
		for (const duration of durationsForUnits(remaining)) {
			beats.push({ kind: 'rest', duration, location: zero() });
		}
		items.push({ beats, location: zero() });
	}
	return items;
}

function zero() {
	return { line: 0, col: 0, length: 0 };
}
