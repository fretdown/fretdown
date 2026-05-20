import type { Connector } from './ir.js';

export interface DecodedNote {
	string: number;
	dead: boolean;
	fret: number | null;
	events: { connector: Connector; fret: number }[];
	articulations: string[];
}

export interface DecodeError {
	error: string;
	offset: number;
}

const CONNECTORS = new Set(['h', 'p', '/', '\\', 'b', 'r']);

/**
 * Decodes a note atom lexeme (e.g. `s3f5h7p5.vib`) into its structured form.
 * Returns a {@link DecodeError} when the lexeme is malformed.
 */
export function decodeNoteAtom(atom: string): DecodedNote | DecodeError {
	let i = 0;

	if (atom[i] !== 's') {
		return { error: "note must begin with 's'", offset: i };
	}
	i++;

	const stringStart = i;
	while (i < atom.length && isDigit(atom[i])) i++;
	if (i === stringStart) {
		return { error: 'missing string number', offset: i };
	}
	const string = Number(atom.slice(stringStart, i));

	let dead = false;
	let fret: number | null = null;

	if (atom[i] === 'x') {
		dead = true;
		i++;
	} else if (atom[i] === 'f') {
		i++;
		const fretStart = i;
		while (i < atom.length && isDigit(atom[i])) i++;
		if (i === fretStart) {
			return { error: 'missing fret number', offset: i };
		}
		fret = Number(atom.slice(fretStart, i));
	} else {
		return { error: "expected 'f' or 'x' after string", offset: i };
	}

	const events: { connector: Connector; fret: number }[] = [];
	while (i < atom.length && CONNECTORS.has(atom[i] as string)) {
		const connector = atom[i] as Connector;
		i++;
		const evStart = i;
		while (i < atom.length && isDigit(atom[i])) i++;
		if (i === evStart) {
			return { error: `connector '${connector}' must be followed by a fret`, offset: i };
		}
		events.push({ connector, fret: Number(atom.slice(evStart, i)) });
	}

	const articulations: string[] = [];
	while (atom[i] === '.') {
		i++;
		const artStart = i;
		while (i < atom.length && isLower(atom[i])) i++;
		if (i === artStart) {
			return { error: 'empty articulation flag', offset: i };
		}
		articulations.push(atom.slice(artStart, i));
	}

	if (i !== atom.length) {
		return { error: `unexpected character '${atom[i]}'`, offset: i };
	}

	if (dead && events.length > 0) {
		return { error: 'a dead note cannot have connectors', offset: stringStart };
	}

	return { string, dead, fret, events, articulations };
}

export function isDecodeError(value: DecodedNote | DecodeError): value is DecodeError {
	return 'error' in value;
}

function isDigit(ch: string | undefined): boolean {
	return ch !== undefined && ch >= '0' && ch <= '9';
}

function isLower(ch: string | undefined): boolean {
	return ch !== undefined && ch >= 'a' && ch <= 'z';
}
