import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Score, parse } from '@fretdown/core';
import { describe, expect, it } from 'vitest';
import { renderToSVG } from './index.js';

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
		// hammer-on annotation and palm-mute label from the guitar verse
		expect(svg).toContain('h3');
		expect(svg).toContain('pm');
	});
});
