export interface InstrumentDef {
	strings: number;
	/** Tuning low pitch → high pitch (highest string number → s1). */
	tuning: string[];
	frets: number;
	/** General MIDI program (0–127) a player uses for this instrument's sound. */
	program: number;
	/** Sample-set id (FluidR3_GM folder) a soundfont player loads for realistic timbre. */
	sample: string;
}

const GUITAR_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const BASS_TUNING = ['E1', 'A1', 'D2', 'G2'];

export const INSTRUMENTS: Record<string, InstrumentDef> = {
	// Generic ids keep their historical defaults (acoustic-ish guitar, finger bass).
	guitar: {
		strings: 6,
		tuning: GUITAR_TUNING,
		frets: 24,
		program: 25,
		sample: 'acoustic_guitar_steel',
	},
	'acoustic-guitar': {
		strings: 6,
		tuning: GUITAR_TUNING,
		frets: 24,
		program: 25,
		sample: 'acoustic_guitar_steel',
	},
	'electric-guitar': {
		strings: 6,
		tuning: GUITAR_TUNING,
		frets: 24,
		program: 27,
		sample: 'electric_guitar_clean',
	},
	guitar7: {
		strings: 7,
		tuning: ['B1', ...GUITAR_TUNING],
		frets: 24,
		program: 27,
		sample: 'electric_guitar_clean',
	},
	bass: { strings: 4, tuning: BASS_TUNING, frets: 24, program: 33, sample: 'electric_bass_finger' },
	'electric-bass': {
		strings: 4,
		tuning: BASS_TUNING,
		frets: 24,
		program: 33,
		sample: 'electric_bass_finger',
	},
	'acoustic-bass': {
		strings: 4,
		tuning: BASS_TUNING,
		frets: 24,
		program: 32,
		sample: 'acoustic_bass',
	},
	bass5: {
		strings: 5,
		tuning: ['B0', ...BASS_TUNING],
		frets: 24,
		program: 33,
		sample: 'electric_bass_finger',
	},
	ukulele: {
		strings: 4,
		tuning: ['G4', 'C4', 'E4', 'A4'],
		frets: 18,
		program: 24,
		sample: 'acoustic_guitar_nylon',
	},
};

export const DEFAULT_FRETS = 24;

export function getInstrument(id: string): InstrumentDef | undefined {
	return INSTRUMENTS[id];
}
