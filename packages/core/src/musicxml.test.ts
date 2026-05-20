import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import { toMusicXML } from './musicxml.js';

function scoreFrom(src: string) {
	const { score } = parse(src);
	if (!score) throw new Error('failed to parse');
	return score;
}

const GUITAR = `@title "Scale & Co"
@artist "Tester"
@tempo 90
@time 4/4
@track Guitar
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4
r:
  | s6f0:4 s5f2 s4f2 s3f0 |
`;

describe('toMusicXML', () => {
	it('produces a score-partwise document', () => {
		const xml = toMusicXML(scoreFrom(GUITAR));
		expect(xml).toContain('<score-partwise version="3.1">');
		expect(xml).toContain('</score-partwise>');
	});

	it('escapes special characters in metadata', () => {
		const xml = toMusicXML(scoreFrom(GUITAR));
		expect(xml).toContain('<work-title>Scale &amp; Co</work-title>');
		expect(xml).toContain('<creator type="composer">Tester</creator>');
	});

	it('emits a TAB clef with staff tuning', () => {
		const xml = toMusicXML(scoreFrom(GUITAR));
		expect(xml).toContain('<sign>TAB</sign>');
		expect(xml).toContain('<staff-lines>6</staff-lines>');
		// bottom line (1) is the lowest string E2
		expect(xml).toContain(
			'<staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>',
		);
	});

	it('writes string/fret technicals and pitch for a note', () => {
		const xml = toMusicXML(scoreFrom(GUITAR));
		expect(xml).toContain('<string>6</string>');
		expect(xml).toContain('<fret>0</fret>');
		// open low E
		expect(xml).toContain('<step>E</step>');
		expect(xml).toContain('<octave>2</octave>');
	});

	it('expands a hammer chain into slurred notes', () => {
		const xml = toMusicXML(scoreFrom('@track G\n@instrument guitar\nr:\n  | s3f5h7:2 s3f5:2 |\n'));
		expect(xml).toContain('<slur type="start" number="1"/>');
		expect(xml).toContain('<slur type="stop" number="1"/>');
		expect(xml).toContain('<fret>7</fret>');
	});

	it('is deterministic and handles the worked example', () => {
		const src = readFileSync(
			fileURLToPath(new URL('../../../fixtures/sunshine-riff.fd', import.meta.url)),
			'utf8',
		);
		const a = toMusicXML(scoreFrom(src));
		const b = toMusicXML(scoreFrom(src));
		expect(a).toBe(b);
		// two parts (guitar + bass)
		expect(a.match(/<part id=/g)?.length).toBe(2);
		expect(a).toContain('<slide type="start" number="1"/>'); // s1f0/3
	});
});
