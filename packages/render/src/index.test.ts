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

	it('draws a slide line for slide connectors', () => {
		const svg = renderToSVG(
			scoreFrom('@track G\n@instrument guitar\nr:\n  | s2f3/5:2 s2f5:2 |\n'),
			{ width: 600 },
		);
		// VexFlow labels tab slides "sl."
		expect(svg).toContain('sl.');
		expect(svg).not.toContain('/5');
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
});
