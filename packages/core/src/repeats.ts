import type { Measure, Score } from './ir.js';

type Item = Score['tracks'][number]['sections'][number]['items'][number];

function isMeasure(it: Item): it is Measure {
	return 'beats' in it;
}

/** Returns a copy of the measure without its repeat/volta markers. */
function plain(it: Item): Item {
	if (!isMeasure(it)) return it;
	const m: Measure = { ...it };
	m.repeatStart = undefined;
	m.repeatEnd = undefined;
	m.volta = undefined;
	return m;
}

/** Flattens a section's items, playing each `|: … :|xN` span N times in a row. */
function expandItems(items: Item[]): Item[] {
	const out: Item[] = [];
	let spanStart = 0;
	for (const it of items) {
		if (isMeasure(it) && it.repeatStart) spanStart = out.length;
		out.push(plain(it));
		if (isMeasure(it) && it.repeatEnd) {
			const span = out.slice(spanStart);
			for (let t = 1; t < it.repeatEnd.times; t++) {
				out.push(...(JSON.parse(JSON.stringify(span)) as Item[]));
			}
			spanStart = out.length;
		}
	}
	return out;
}

/**
 * Returns a score with every repeat expanded into literal repetitions — so a `|: … :|x6`
 * riff becomes six copies. Voltas are not handled (each pass plays the same bars); the
 * importer and playground use this to show/play what a repeat actually sounds like.
 */
export function expandRepeats(score: Score): Score {
	return {
		...score,
		tracks: score.tracks.map((track) => ({
			...track,
			sections: track.sections.map((section) => ({
				...section,
				items: expandItems(section.items),
			})),
		})),
	};
}
