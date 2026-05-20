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
}

/** Best-effort conversion of legacy ASCII tab into a partial Fretdown score. */
export function parseAsciiTab(text: string): AsciiResult {
	const ambiguities: string[] = [];
	const rawLines = text.split('\n');

	const groups = findTabBlocks(rawLines);
	if (groups.length === 0) {
		return { score: null, fretdown: null, confidence: 0, ambiguities: ['no-tab-block-found'] };
	}

	// Tabs usually stack several systems (line groups) of the same string count — play them
	// back to back. The most common group size wins; odd-sized groups are skipped.
	const stringCount = mode(groups.map((g) => g.length));
	const systems = groups.filter((g) => g.length === stringCount);
	if (systems.length > 1) ambiguities.push('multi-system');

	const tuningInfo = INSTRUMENT_BY_STRINGS[stringCount];
	if (!tuningInfo) ambiguities.push('unusual-string-count');
	ambiguities.push('rhythm-approximated', 'tuning-guessed');

	let hasConnectors = false;
	const onsets = systems.flatMap((group) => {
		const perString = trimBodies(group).map((body) => {
			const tokens = tokenizeLine(body);
			if (tokens.some((t) => t.connector)) hasConnectors = true;
			return tokens;
		});
		return systemEvents(perString, stringCount);
	});
	if (hasConnectors) ambiguities.push('techniques-approximated');

	// 4/4 default → 8 eighth notes per bar.
	const beats = layoutBars(onsets, 8);

	// A trailing "(6x)" / "x6" annotation means the riff repeats — wrap the whole thing.
	const repeatTimes = detectRepeat(rawLines);
	if (repeatTimes && beats.length > 0) {
		const first = beats[0] as { repeatStart?: boolean };
		const last = beats[beats.length - 1] as { repeatEnd?: { times: number } };
		first.repeatStart = true;
		last.repeatEnd = { times: repeatTimes };
		ambiguities.push('repeat-detected');
	}

	const score: Score = {
		metadata: { time: { numerator: 4, denominator: 4 }, capo: 0 },
		tracks: [
			{
				name: stringCount <= 4 ? 'Bass' : 'Guitar',
				instrument: tuningInfo?.instrument,
				tuning: tuningInfo?.tuning ?? Array.from({ length: stringCount }, () => 'E2'),
				frets: 24,
				capo: 0,
				sections: [{ label: 'tab', items: beats, location: zero() }],
				location: zero(),
			},
		],
	};

	let confidence = 0.8;
	if (!tuningInfo) confidence -= 0.2;
	if (hasConnectors) confidence -= 0.1;
	confidence = Math.max(0.1, Math.min(0.9, confidence));

	return { score, fretdown: serialize(score), confidence, ambiguities };
}

/** Finds every group of consecutive tab lines (each a "system"); blank/prose lines separate. */
function findTabBlocks(lines: string[]): string[][] {
	const groups: string[][] = [];
	let current: string[] = [];
	const flush = () => {
		if (current.length >= 2) groups.push(current);
		current = [];
	};
	for (const line of lines) {
		if (isTabLine(line)) current.push(line);
		else flush();
	}
	flush();
	return groups;
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

/** Turns one system's tokens into ordered onsets, inferring each note's length from spacing. */
function systemEvents(perString: LineToken[][], stringCount: number): Onset[] {
	// Attach connector tokens to the previous note on the same string; collect notes by column.
	const noteByStringCol = new Map<string, Note>();
	const colSet = new Set<number>();

	perString.forEach((tokens, lineIdx) => {
		const stringNumber = lineIdx + 1; // top line = string 1
		let lastNote: Note | null = null;
		for (const t of tokens) {
			if (t.connector && lastNote) {
				lastNote.events.push({ connector: t.connector, fret: t.fret ?? 0 });
				continue;
			}
			const note: Note = {
				string: stringNumber,
				dead: t.fret === null,
				fret: t.fret,
				events: [],
				articulations: [],
				location: zero(),
			};
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
