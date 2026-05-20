import { type Beat, type Connector, type Note, type Score, serialize } from '@fretdown/core';

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

	const group = findTabBlock(rawLines);
	if (group.length < 2) {
		return { score: null, fretdown: null, confidence: 0, ambiguities: ['no-tab-block-found'] };
	}

	const stringCount = group.length;
	const tuningInfo = INSTRUMENT_BY_STRINGS[stringCount];
	if (!tuningInfo) ambiguities.push('unusual-string-count');
	ambiguities.push('rhythm-approximated', 'tuning-guessed');

	// Strip the leading label (everything up to and including the first '|').
	const bodies = group.map((line) => {
		const bar = line.indexOf('|');
		return bar >= 0 ? line.slice(bar) : line;
	});

	let hasConnectors = false;
	const perString: LineToken[][] = bodies.map((body) => {
		const tokens = tokenizeLine(body);
		if (tokens.some((t) => t.connector)) hasConnectors = true;
		return tokens;
	});
	if (hasConnectors) ambiguities.push('techniques-approximated');

	const barCols = barlineColumns(bodies);
	const beats = assembleBeats(perString, barCols, stringCount);

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
	if (barCols.length === 0) confidence -= 0.1;
	confidence = Math.max(0.1, Math.min(0.9, confidence));

	return { score, fretdown: serialize(score), confidence, ambiguities };
}

function findTabBlock(lines: string[]): string[] {
	let best: string[] = [];
	let current: string[] = [];
	const flush = () => {
		if (current.length > best.length) best = current;
		current = [];
	};
	for (const line of lines) {
		if (isTabLine(line)) current.push(line);
		else flush();
	}
	flush();
	return best;
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

function barlineColumns(bodies: string[]): number[] {
	const width = Math.max(...bodies.map((b) => b.length));
	const cols: number[] = [];
	for (let c = 0; c < width; c++) {
		if (bodies.every((b) => b[c] === '|')) cols.push(c);
	}
	return cols;
}

function assembleBeats(
	perString: LineToken[][],
	barCols: number[],
	stringCount: number,
): Score['tracks'][number]['sections'][number]['items'] {
	// Attach connector tokens to the previous note on the same string; collect plain notes by column.
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
	const segments = [0, ...barCols, Number.MAX_SAFE_INTEGER];
	const items: ReturnType<typeof assembleBeats> = [];

	for (let s = 0; s < segments.length - 1; s++) {
		const lo = segments[s] as number;
		const hi = segments[s + 1] as number;
		const measureCols = cols.filter((c) => c > lo && c < hi);
		if (measureCols.length === 0) continue;
		const beats: Beat[] = measureCols.map((c) => {
			const notes: Note[] = [];
			for (let str = 1; str <= stringCount; str++) {
				const n = noteByStringCol.get(`${c}:${str}`);
				if (n) notes.push(n);
			}
			const duration = { value: 8 as const, dotted: false };
			if (notes.length === 1) {
				return { kind: 'note', note: notes[0] as Note, duration, location: zero() };
			}
			return { kind: 'chord', notes, duration, location: zero() };
		});
		items.push({ beats, location: zero() });
	}
	return items;
}

function zero() {
	return { line: 0, col: 0, length: 0 };
}
