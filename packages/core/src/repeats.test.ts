import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import { expandRepeats } from './repeats.js';

function measures(src: string) {
	const { score } = parse(src);
	if (!score) throw new Error('parse failed');
	return expandRepeats(score).tracks[0]!.sections[0]!.items;
}

const SRC = `@track G
@instrument guitar
@tuning E2 A2 D3 G3 B3 E4
r:
  |: s6f0:1 | s6f3:1 :|x3
`;

describe('expandRepeats', () => {
	it('plays a |: … :|xN span N times', () => {
		// two bars repeated 3× → six bars
		expect(measures(SRC)).toHaveLength(6);
	});

	it('strips repeat markers from the expansion', () => {
		const items = measures(SRC) as Array<{ repeatStart?: boolean; repeatEnd?: unknown }>;
		expect(items.some((m) => m.repeatStart || m.repeatEnd)).toBe(false);
	});

	it('leaves a score without repeats unchanged in length', () => {
		const src =
			'@track G\n@instrument guitar\n@tuning E2 A2 D3 G3 B3 E4\nr:\n  | s6f0:1 | s6f3:1 |\n';
		expect(measures(src)).toHaveLength(2);
	});
});
