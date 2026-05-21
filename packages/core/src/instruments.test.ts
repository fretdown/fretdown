import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, getInstrument } from './instruments.js';

describe('INSTRUMENTS', () => {
	it('includes acoustic/electric variants that share tuning with the generic ids', () => {
		expect(getInstrument('electric-guitar')?.tuning).toEqual(getInstrument('guitar')?.tuning);
		expect(getInstrument('acoustic-bass')?.tuning).toEqual(getInstrument('bass')?.tuning);
	});

	it('gives every instrument a GM program and a sample set', () => {
		for (const [id, def] of Object.entries(INSTRUMENTS)) {
			expect(def.program, id).toBeGreaterThanOrEqual(0);
			expect(def.program, id).toBeLessThan(128);
			expect(def.sample, id).toBeTruthy();
		}
	});

	it('distinguishes electric from acoustic by sound, not tuning', () => {
		const electric = getInstrument('electric-guitar');
		const acoustic = getInstrument('acoustic-guitar');
		expect(electric?.program).not.toBe(acoustic?.program);
		expect(electric?.tuning).toEqual(acoustic?.tuning);
	});
});
