import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Score, parse } from '@fretdown/core';
import { describe, expect, it } from 'vitest';
import { computeLayout, renderToSVG } from './index.js';

function scoreFrom(source: string): Score {
	const { score } = parse(source);
	if (!score) throw new Error('failed to parse');
	return score;
}

const SIMPLE_GUITAR = `@title "Scale"
@tempo 90
@time 4/4

@track Guitar
@instrument guitar
riff:
  | s6f0:8 s6f3 s5f0 s5f2 s5f3 s4f0 s4f2 s4f3 |
`;

const BASS_LINE = `@title "Groove"
@time 4/4

@track Bass
@instrument bass
line:
  | s4f0:4 s3f2 s4f0:8 s4f0 s3f0:4 |
`;

describe('renderToSVG', () => {
	it('produces an SVG document', () => {
		const svg = renderToSVG(scoreFrom(SIMPLE_GUITAR));
		expect(svg.trimStart().startsWith('<svg')).toBe(true);
		expect(svg).toContain('</svg>');
	});

	it('renders a 6-line tab clef for guitar', () => {
		const svg = renderToSVG(scoreFrom(SIMPLE_GUITAR));
		// TAB clef letters are drawn as text.
		expect(svg).toContain('<text');
		expect(svg).toContain('Scale');
	});

	it('renders a bass track', () => {
		const svg = renderToSVG(scoreFrom(BASS_LINE));
		expect(svg).toContain('Bass');
		expect(svg.trimStart().startsWith('<svg')).toBe(true);
	});

	it('matches the simple guitar snapshot', () => {
		expect(renderToSVG(scoreFrom(SIMPLE_GUITAR), { width: 600 })).toMatchSnapshot();
	});

	it('matches the bass snapshot', () => {
		expect(renderToSVG(scoreFrom(BASS_LINE), { width: 600 })).toMatchSnapshot();
	});

	it('renders the worked example with both tracks and techniques', () => {
		const src = readFileSync(
			fileURLToPath(new URL('../../../fixtures/sunshine-riff.fd', import.meta.url)),
			'utf8',
		);
		const svg = renderToSVG(scoreFrom(src), { measuresPerLine: 2 });
		expect(svg).toContain('Guitar');
		expect(svg).toContain('Bass');
		// the s5f2h3 hammer-on now draws a real tie (not an "h3" text annotation)
		expect(svg).toContain('vf-stavetie');
		// palm-mute label from the guitar verse stays an annotation
		expect(svg).toContain('pm');
	});

	it('expands a hammer chain into slurred noteheads', () => {
		// 3 events → 4 noteheads (a power-of-two chain), so a quarter subdivides into 16ths.
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s3f5h7h9p7:4 s3f5:2 |\n'),
			{ width: 600 },
		);
		// frets 5 → 7 → 9 → 7 are four separate noteheads joined by three ties.
		expect(svg.match(/vf-stavetie/g)?.length).toBe(3);
		expect(svg).toContain('>9<');
		// no fallback text annotation for the chain.
		expect(svg).not.toContain('h7');
		expect(svg).not.toContain('p7');
	});

	it('draws bends/releases as arrows on the notehead and the trailing pull as a tie', () => {
		// s3f9 bent (and released), then a pull-off to 7 — the pull must be a tie, not a "p7" label
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s3f9b11b11r9p7:4 s3f7:2 s3f7:4 |\n'),
			{ width: 600 },
		);
		expect(/<text[^>]*>p7<\/text>/.test(svg)).toBe(false);
		expect(svg.match(/vf-stavetie/g)?.length).toBe(1); // the pull-off
		expect(/Full|½/.test(svg)).toBe(true); // bend arrows still drawn
	});

	it('expands an odd-length chain (drawn as a tuplet) instead of a text label', () => {
		// s4f7/9\7 has 2 events → length 3 (not a power of two): a tuplet, not a label
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s4f7/9\\7:4 s4f7:2 s4f7:4 |\n'),
			{ width: 600 },
		);
		// two slide lines (up to 9, back down to 7), no "/9" / "\\7" fallback text
		expect(svg.match(/sl\./g)?.length).toBe(2);
		expect(svg).not.toContain('/9');
		expect(svg).toContain('>9<');
	});

	it('expands a slide inside a chord (one slide line per string)', () => {
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | (s5f17\\16 s6f15\\14):4. (s6f0 s5f0):8 |\n'),
			{ width: 600 },
		);
		// no "\\14"/"\\16" fallback labels; both strings get a slide line
		expect(svg.includes('\\14')).toBe(false);
		expect(svg.match(/sl\./g)?.length).toBe(2);
		expect(svg).toContain('>16<');
		expect(svg).toContain('>14<');
	});

	it('draws a slide line for slide connectors', () => {
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s2f3/5:2 s2f5:2 |\n'),
			{ width: 600 },
		);
		// VexFlow labels tab slides "sl."
		expect(svg).toContain('sl.');
		expect(svg).not.toContain('/5');
	});

	it('expands a dotted pull-off chain into slurred noteheads (not a label)', () => {
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s2f15p14:4. s2f3:8 |\n'),
			{ width: 600 },
		);
		// fret 15 → 14 are two noteheads joined by a tie, with no fallback "p14" text
		expect(svg.match(/vf-stavetie/g)?.length).toBe(1);
		expect(svg).toContain('>14<');
		expect(/<text[^>]*>p14<\/text>/.test(svg)).toBe(false);
	});

	it('still places a non-expandable technique label above the staff', () => {
		// a bend ('b') isn't a transition connector, so it keeps a label — which must sit on top
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s2f15.pm:4. s2f3:8 |\n'),
			{ width: 600 },
		);
		const annotationY = Number(
			svg.match(/<text stroke="none" x="[\d.]+" y="([\d.]+)">pm<\/text>/)?.[1],
		);
		const topLineY = Number(svg.match(/<path fill="none" d="M[\d.]+ ([\d.]+)/)?.[1]);
		expect(annotationY).toBeLessThan(topLineY);
	});

	it('folds a bend-and-release into the bend, with no floating "rel"', () => {
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s1f14b15r14:2 s1f0:2 |\n'),
			{
				width: 600,
			},
		);
		expect(/<text[^>]*>rel<\/text>/.test(svg)).toBe(false);
	});

	it('draws a downward slide when the target fret is lower', () => {
		// a slide from fret 7 down to fret 3 should render (direction taken from the frets)
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s2f7/3:2 s2f3:2 |\n'),
			{ width: 600 },
		);
		expect(svg).toContain('sl.');
		expect(svg).toContain('>7<');
		expect(svg).toContain('>3<');
	});

	it('labels each string with its open-note letter in the left gutter', () => {
		const svg = renderToSVG(scoreFrom(SIMPLE_GUITAR), { width: 600 });
		const labels = [...svg.matchAll(/<text[^>]*x="12"[^>]*>([A-G])<\/text>/g)].map((m) => m[1]);
		// standard guitar tuning, top line (high E) down to bottom (low E)
		expect(labels).toEqual(['E', 'B', 'G', 'D', 'A', 'E']);
	});

	it('computeLayout boxes line up with the rendered stave lines', () => {
		const score = scoreFrom(SIMPLE_GUITAR);
		const opts = { width: 600, measuresPerLine: 2 } as const;
		const layout = computeLayout(score, opts);
		const svg = renderToSVG(score, opts);
		const firstLineY = Number(svg.match(/<path fill="none" d="M[\d.]+ ([\d.]+)/)?.[1]);
		// the first measure box top should sit on the first (top) stave line, not above it
		expect(layout.measures[0]?.y).toBeCloseTo(firstLineY, 0);
		// six guitar strings → box spans five line gaps
		expect(layout.measures[0]?.height).toBe(5 * 13);
	});

	it('reports noteX after the clef/time signature so a cursor can align to the notes', () => {
		const score = scoreFrom(SIMPLE_GUITAR);
		const layout = computeLayout(score, { width: 600, measuresPerLine: 2 });
		const first = layout.measures[0];
		const svg = renderToSVG(score, { width: 600, measuresPerLine: 2 });
		const firstNoteX = Number(
			svg.match(/<g class="vf-tabnote"[^>]*>[\s\S]*?<text stroke="none" x="([\d.]+)"/)?.[1],
		);
		// notes begin well right of the box edge, just left of the first rendered notehead
		expect(first?.noteX).toBeGreaterThan(first?.x ?? 0);
		expect(first?.noteX).toBeLessThanOrEqual(firstNoteX);
		expect(firstNoteX - (first?.noteX ?? 0)).toBeLessThan(20);
	});
});
