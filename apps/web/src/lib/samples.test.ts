import { parse, validate } from '@fretdown/core';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from './samples';

describe('SAMPLES', () => {
	it('every built-in sample parses and validates without errors', () => {
		for (const sample of SAMPLES) {
			const { score, diagnostics } = parse(sample.source);
			const all = [...diagnostics, ...(score ? validate(score) : [])];
			const errors = all.filter((d) => d.severity === 'error');
			expect({ name: sample.name, errors }).toEqual({ name: sample.name, errors: [] });
		}
	});

	it('has unique sample names', () => {
		const names = SAMPLES.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
	});
});
