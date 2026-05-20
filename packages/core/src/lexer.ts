import { type ILexingResult, Lexer, createToken } from 'chevrotain';

export const Comment = createToken({
	name: 'Comment',
	pattern: /#[^\n]*/,
	group: Lexer.SKIPPED,
});

export const WhiteSpace = createToken({
	name: 'WhiteSpace',
	pattern: /[ \t\r]+/,
	group: Lexer.SKIPPED,
});

export const Newline = createToken({ name: 'Newline', pattern: /\n+/ });

export const QuotedString = createToken({
	name: 'QuotedString',
	pattern: /"(?:\\.|[^"\\])*"/,
});

export const RepeatOpen = createToken({ name: 'RepeatOpen', pattern: /\|:/ });
export const RepeatClose = createToken({ name: 'RepeatClose', pattern: /:\|/ });
export const Bar = createToken({ name: 'Bar', pattern: /\|/ });

function dir(name: string, keyword: string) {
	return createToken({ name, pattern: new RegExp(`@${keyword}\\b`) });
}

export const TitleDir = dir('TitleDir', 'title');
export const ArtistDir = dir('ArtistDir', 'artist');
export const AlbumDir = dir('AlbumDir', 'album');
export const TempoDir = dir('TempoDir', 'tempo');
export const TimeDir = dir('TimeDir', 'time');
export const KeyDir = dir('KeyDir', 'key');
export const CapoDir = dir('CapoDir', 'capo');
export const ArrangeDir = dir('ArrangeDir', 'arrange');
export const TrackDir = dir('TrackDir', 'track');
export const InstrumentDir = dir('InstrumentDir', 'instrument');
export const TuningDir = dir('TuningDir', 'tuning');
export const FretsDir = dir('FretsDir', 'frets');
export const SegnoDir = dir('SegnoDir', 'segno');
export const CodaDir = dir('CodaDir', 'coda');
export const FineDir = dir('FineDir', 'fine');

/** Fallback for any unrecognized @directive, so unknown directives lex (and then fail to parse). */
export const Directive = createToken({
	name: 'Directive',
	pattern: /@[a-zA-Z][a-zA-Z0-9-]*/,
});

export const NoteAtom = createToken({
	name: 'NoteAtom',
	pattern: /s\d+(?:f\d+|x)(?:[hpbr/\\]\d+)*(?:\.[a-z]+)*/,
});

export const Tuplet = createToken({ name: 'Tuplet', pattern: /t\d+/ });
export const RepeatCount = createToken({ name: 'RepeatCount', pattern: /x\d+/ });
export const Rest = createToken({ name: 'Rest', pattern: /_/ });

export const Fraction = createToken({ name: 'Fraction', pattern: /\d+\/\d+/ });
export const NumberLit = createToken({ name: 'NumberLit', pattern: /\d+/ });

export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ });
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });

export const Identifier = createToken({
	name: 'Identifier',
	pattern: /[A-Za-z_][A-Za-z0-9_#-]*/,
});

// Order matters: longest-match wins, ties resolved by position in this list.
export const allTokens = [
	Comment,
	WhiteSpace,
	Newline,
	QuotedString,
	RepeatOpen,
	RepeatClose,
	Bar,
	TitleDir,
	ArtistDir,
	AlbumDir,
	TempoDir,
	TimeDir,
	KeyDir,
	CapoDir,
	ArrangeDir,
	TrackDir,
	InstrumentDir,
	TuningDir,
	FretsDir,
	SegnoDir,
	CodaDir,
	FineDir,
	Directive,
	NoteAtom,
	Tuplet,
	RepeatCount,
	Rest,
	Fraction,
	NumberLit,
	Dot,
	Colon,
	LParen,
	RParen,
	LBracket,
	RBracket,
	Comma,
	Identifier,
];

export const fretdownLexer = new Lexer(allTokens, { positionTracking: 'full' });

export function tokenize(source: string): ILexingResult {
	return fretdownLexer.tokenize(source);
}
