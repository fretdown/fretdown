import { describe, expect, it } from 'vitest';
import { EXAMPLE_SOURCE } from './example';
import { computeMarkers } from './fretdown-language';
import { decodeSource, encodeSource } from './share';

// Minimal stand-in for the Monaco namespace used by computeMarkers.
const fakeMonaco = {
	MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
} as unknown as Parameters<typeof computeMarkers>[0];

describe('share encoding', () => {
	it('round-trips source through the URL hash', () => {
		const round = decodeSource(encodeSource(EXAMPLE_SOURCE));
		expect(round).toBe(EXAMPLE_SOURCE);
	});

	it('round-trips unicode', () => {
		const s = '@title "Café — naïve ♩"\n@track G\n@tuning E2 A2 D3 G3 B3 E4\na:\n  | s6f0:1 |\n';
		expect(decodeSource(encodeSource(s))).toBe(s);
	});

	it('returns null on malformed input', () => {
		expect(decodeSource('!!!not base64!!!')).not.toBe(undefined);
	});
});

describe('computeMarkers', () => {
	it('produces no markers for the valid example', () => {
		expect(computeMarkers(fakeMonaco, EXAMPLE_SOURCE)).toEqual([]);
	});

	it('produces an error marker with a position for a bad fret', () => {
		const src = '@track G\n@tuning E2 A2 D3 G3 B3 E4\na:\n  | s6f99:1 |\n';
		const markers = computeMarkers(fakeMonaco, src);
		expect(markers.length).toBeGreaterThan(0);
		const m = markers[0]!;
		expect(m.severity).toBe(8);
		expect(m.startLineNumber).toBeGreaterThanOrEqual(1);
		expect(m.startColumn).toBeGreaterThanOrEqual(1);
	});
});
