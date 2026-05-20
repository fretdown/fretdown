import { buildScore } from './build.js';
import type { Diagnostic, ParseResult } from './ir.js';
import { tokenize } from './lexer.js';
import { parserInstance } from './parser.js';

export * from './ir.js';
export { decodeNoteAtom, isDecodeError } from './note-atom.js';
export type { DecodedNote, DecodeError } from './note-atom.js';
export { INSTRUMENTS, getInstrument, DEFAULT_FRETS } from './instruments.js';
export type { InstrumentDef } from './instruments.js';
export { parsePitch, isValidPitch } from './pitch.js';
export type { ParsedPitch } from './pitch.js';
export { validate, beatDuration } from './validator.js';
export { serialize } from './serialize.js';
export { parseAsciiTab } from './ascii.js';
export type { AsciiResult } from './ascii.js';

/** Parses Fretdown source into a {@link Score}, collecting lexer and parser diagnostics. */
export function parse(source: string): ParseResult {
	const diagnostics: Diagnostic[] = [];

	const lexResult = tokenize(source);
	for (const err of lexResult.errors) {
		diagnostics.push({
			severity: 'error',
			code: 'lex.error',
			message: err.message,
			location: { line: err.line ?? 0, col: err.column ?? 0, length: err.length ?? 1 },
		});
	}

	parserInstance.input = lexResult.tokens;
	const doc = parserInstance.document();

	for (const err of parserInstance.errors) {
		const token = err.token;
		diagnostics.push({
			severity: 'error',
			code: 'parse.error',
			message: err.message,
			location: {
				line: token?.startLine ?? 0,
				col: token?.startColumn ?? 0,
				length: token?.image?.length ?? 1,
			},
		});
	}

	if (!doc || parserInstance.errors.length > 0) {
		const score = doc ? buildScore(doc, diagnostics) : null;
		return { score, diagnostics };
	}

	const score = buildScore(doc, diagnostics);
	return { score, diagnostics };
}
