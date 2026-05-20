export interface InstrumentDef {
	strings: number;
	/** Tuning low pitch → high pitch (highest string number → s1). */
	tuning: string[];
	frets: number;
}

export const INSTRUMENTS: Record<string, InstrumentDef> = {
	guitar: { strings: 6, tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], frets: 24 },
	guitar7: { strings: 7, tuning: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'], frets: 24 },
	bass: { strings: 4, tuning: ['E1', 'A1', 'D2', 'G2'], frets: 24 },
	bass5: { strings: 5, tuning: ['B0', 'E1', 'A1', 'D2', 'G2'], frets: 24 },
	ukulele: { strings: 4, tuning: ['G4', 'C4', 'E4', 'A4'], frets: 18 },
};

export const DEFAULT_FRETS = 24;

export function getInstrument(id: string): InstrumentDef | undefined {
	return INSTRUMENTS[id];
}
