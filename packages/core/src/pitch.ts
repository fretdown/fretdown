const PITCH_RE = /^([A-G])(#|b)?(-?\d+)$/;

const SEMITONES: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11,
};

export interface ParsedPitch {
	letter: string;
	accidental: '#' | 'b' | null;
	octave: number;
	/** MIDI note number (C-1 = 0, middle C = 60). */
	midi: number;
}

export function parsePitch(text: string): ParsedPitch | null {
	const m = PITCH_RE.exec(text);
	if (!m) return null;
	const [, letter, accidental, octaveStr] = m;
	const octave = Number(octaveStr);
	let semitone = SEMITONES[letter as string] as number;
	if (accidental === '#') semitone += 1;
	else if (accidental === 'b') semitone -= 1;
	const midi = (octave + 1) * 12 + semitone;
	return {
		letter: letter as string,
		accidental: (accidental as '#' | 'b' | undefined) ?? null,
		octave,
		midi,
	};
}

export function isValidPitch(text: string): boolean {
	return parsePitch(text) !== null;
}
