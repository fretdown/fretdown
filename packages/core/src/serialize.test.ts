import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import { serialize } from './serialize.js';
import { validate } from './validator.js';

// Locations naturally differ after re-serialization; compare the musical content only.
function stripLocations<T>(value: T): T {
	return JSON.parse(JSON.stringify(value, (key, val) => (key === 'location' ? undefined : val)));
}

describe('serialize', () => {
	it('round-trips the worked example to an equivalent score', () => {
		const src = readFileSync(
			fileURLToPath(new URL('../../../fixtures/sunshine-riff.fd', import.meta.url)),
			'utf8',
		);
		const first = parse(src).score!;
		const text = serialize(first);
		const second = parse(text).score!;
		expect(stripLocations(second)).toEqual(stripLocations(first));
		expect(validate(second)).toEqual([]);
	});

	it('emits explicit durations and metadata', () => {
		const score = parse(
			'@title "T"\n@track G\n@tuning E2 A2 D3 G3 B3 E4\na:\n  | s6f0:8 s6f0 s6f0 s6f0 s6f0 s6f0 s6f0 s6f0 |\n',
		).score!;
		const text = serialize(score);
		expect(text).toContain('@title "T"');
		expect(text).toContain('@time 4/4');
		expect(text).toContain('s6f0:8');
	});

	it('serializes repeats, voltas, chords, rests, and tuplets', () => {
		const src = `@track G
@tuning E2 A2 D3 G3 B3 E4
a:
  |: (s4f2 s3f2):4 _:4 t3( s6f0:8 s6f2:8 s6f3:8 ) s6f0:4 |
  [1] s6f0:1 :|
  [2] s6f0:1 |
`;
		const score = parse(src).score!;
		const round = parse(serialize(score)).score!;
		expect(stripLocations(round)).toEqual(stripLocations(score));
	});
});
