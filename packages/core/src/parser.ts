import { EmbeddedActionsParser, type IToken, type TokenType } from 'chevrotain';
import type { Connector, Duration, Location, NoteValue } from './ir.js';
import {
	AlbumDir,
	ArrangeDir,
	ArtistDir,
	Bar,
	CapoDir,
	CodaDir,
	Colon,
	Comma,
	Dot,
	FineDir,
	Fraction,
	FretsDir,
	Identifier,
	InstrumentDir,
	KeyDir,
	LBracket,
	LParen,
	Newline,
	NoteAtom,
	NumberLit,
	QuotedString,
	RBracket,
	RParen,
	RepeatClose,
	RepeatCount,
	RepeatOpen,
	Rest,
	SegnoDir,
	TempoDir,
	TimeDir,
	TitleDir,
	TrackDir,
	TuningDir,
	Tuplet,
	allTokens,
} from './lexer.js';

export interface RawNote {
	atom: string;
	location: Location;
}

export type RawBeat =
	| { kind: 'note'; atom: string; duration: Duration | null; location: Location }
	| { kind: 'chord'; notes: RawNote[]; duration: Duration | null; location: Location }
	| { kind: 'rest'; duration: Duration | null; location: Location }
	| { kind: 'tuplet'; n: number; beats: RawBeat[]; location: Location };

export type MusicItem =
	| { type: 'beat'; beat: RawBeat }
	| { type: 'bar' }
	| { type: 'repeatOpen' }
	| { type: 'repeatClose'; times: number }
	| { type: 'volta'; numbers: number[]; location: Location }
	| { type: 'nav'; marker: 'segno' | 'coda' | 'fine'; location: Location };

export interface RawSection {
	label: string;
	items: MusicItem[];
	location: Location;
}

export interface RawTrack {
	name: string;
	instrument?: string;
	tuning: string[];
	frets?: number;
	capo?: number;
	sections: RawSection[];
	location: Location;
}

export interface RawDoc {
	metadata: {
		title?: string;
		artist?: string;
		album?: string;
		tempo?: number;
		time?: { numerator: number; denominator: number };
		key?: string;
		capo?: number;
	};
	arrange?: string[];
	tracks: RawTrack[];
}

function loc(token: IToken): Location {
	return {
		line: token.startLine ?? 0,
		col: token.startColumn ?? 0,
		length: token.image.length,
	};
}

const HEADER_DIRS: TokenType[] = [
	TitleDir,
	ArtistDir,
	AlbumDir,
	TempoDir,
	TimeDir,
	KeyDir,
	CapoDir,
	ArrangeDir,
];
const TRACK_DIRS: TokenType[] = [InstrumentDir, TuningDir, FretsDir, CapoDir];
const NAV_DIRS: TokenType[] = [SegnoDir, CodaDir, FineDir];

class FretdownParser extends EmbeddedActionsParser {
	constructor() {
		super(allTokens, { recoveryEnabled: false });
		this.performSelfAnalysis();
	}

	private nl = this.RULE('nl', () => {
		this.MANY(() => this.CONSUME(Newline));
	});

	public document = this.RULE('document', (): RawDoc => {
		const doc: RawDoc = { metadata: {}, tracks: [] };
		this.SUBRULE(this.nl);
		this.MANY({
			GATE: () => HEADER_DIRS.includes(this.LA(1).tokenType),
			DEF: () => {
				const part = this.SUBRULE(this.headerDirective);
				if (part) {
					if (part.meta) Object.assign(doc.metadata, part.meta);
					if (part.arrange) doc.arrange = part.arrange;
				}
				this.SUBRULE1(this.nl);
			},
		});
		this.MANY1({
			GATE: () => this.LA(1).tokenType === TrackDir,
			DEF: () => {
				doc.tracks.push(this.SUBRULE(this.track));
			},
		});
		return doc;
	});

	private headerDirective = this.RULE(
		'headerDirective',
		(): { meta?: Partial<RawDoc['metadata']>; arrange?: string[] } => {
			return this.OR([
				{
					ALT: () => {
						this.CONSUME(TitleDir);
						return { meta: { title: this.SUBRULE(this.quoted) } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(ArtistDir);
						return { meta: { artist: this.SUBRULE1(this.quoted) } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(AlbumDir);
						return { meta: { album: this.SUBRULE2(this.quoted) } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(TempoDir);
						return { meta: { tempo: Number(this.CONSUME(NumberLit).image) } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(TimeDir);
						const f = this.CONSUME(Fraction).image.split('/');
						return { meta: { time: { numerator: Number(f[0]), denominator: Number(f[1]) } } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(KeyDir);
						return { meta: { key: this.CONSUME(Identifier).image } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(CapoDir);
						return { meta: { capo: Number(this.CONSUME1(NumberLit).image) } };
					},
				},
				{
					ALT: () => {
						this.CONSUME(ArrangeDir);
						const labels: string[] = [];
						this.MANY(() => labels.push(this.CONSUME1(Identifier).image));
						return { arrange: labels };
					},
				},
			]);
		},
	);

	private quoted = this.RULE('quoted', (): string => unquote(this.CONSUME(QuotedString).image));

	private track = this.RULE('track', (): RawTrack => {
		const head = this.CONSUME(TrackDir);
		const track: RawTrack = { name: '', tuning: [], sections: [], location: loc(head) };
		track.name = this.OR([
			{ ALT: () => this.CONSUME(Identifier).image },
			{ ALT: () => this.SUBRULE(this.quoted) },
		]);
		this.SUBRULE(this.nl);
		this.MANY({
			GATE: () => TRACK_DIRS.includes(this.LA(1).tokenType),
			DEF: () => {
				const part = this.SUBRULE(this.trackDirective);
				if (part) {
					if (part.instrument !== undefined) track.instrument = part.instrument;
					if (part.tuning) track.tuning = part.tuning;
					if (part.frets !== undefined) track.frets = part.frets;
					if (part.capo !== undefined) track.capo = part.capo;
				}
				this.SUBRULE1(this.nl);
			},
		});
		this.MANY1({
			GATE: () => this.LA(1).tokenType === Identifier,
			DEF: () => {
				track.sections.push(this.SUBRULE(this.section));
			},
		});
		return track;
	});

	private trackDirective = this.RULE(
		'trackDirective',
		(): { instrument?: string; tuning?: string[]; frets?: number; capo?: number } => {
			return this.OR([
				{
					ALT: () => {
						this.CONSUME(InstrumentDir);
						return { instrument: this.CONSUME(Identifier).image };
					},
				},
				{
					ALT: () => {
						this.CONSUME(TuningDir);
						const tuning: string[] = [];
						this.MANY(() => tuning.push(this.CONSUME1(Identifier).image));
						return { tuning };
					},
				},
				{
					ALT: () => {
						this.CONSUME(FretsDir);
						return { frets: Number(this.CONSUME(NumberLit).image) };
					},
				},
				{
					ALT: () => {
						this.CONSUME(CapoDir);
						return { capo: Number(this.CONSUME1(NumberLit).image) };
					},
				},
			]);
		},
	);

	private section = this.RULE('section', (): RawSection => {
		const label = this.CONSUME(Identifier);
		this.CONSUME(Colon);
		this.SUBRULE(this.nl);
		const items: MusicItem[] = [];
		this.MANY({
			GATE: () => this.isMusicItemAhead(),
			DEF: () => {
				const item = this.SUBRULE(this.musicItem);
				if (item) items.push(item);
			},
		});
		return { label: label.image, items, location: loc(label) };
	});

	private isMusicItemAhead(): boolean {
		const t = this.LA(1).tokenType;
		return (
			t === Bar ||
			t === RepeatOpen ||
			t === RepeatClose ||
			t === LBracket ||
			t === NoteAtom ||
			t === LParen ||
			t === Rest ||
			t === Tuplet ||
			t === Newline ||
			NAV_DIRS.includes(t)
		);
	}

	private musicItem = this.RULE('musicItem', (): MusicItem | undefined => {
		return this.OR([
			{
				ALT: () => {
					this.CONSUME(Newline);
					return undefined;
				},
			},
			{
				ALT: () => {
					this.CONSUME(RepeatOpen);
					return { type: 'repeatOpen' } as const;
				},
			},
			{
				ALT: () => {
					this.CONSUME(RepeatClose);
					let times = 2;
					this.OPTION(() => {
						times = Number(this.CONSUME(RepeatCount).image.slice(1));
					});
					return { type: 'repeatClose', times } as const;
				},
			},
			{
				ALT: () => {
					this.CONSUME(Bar);
					return { type: 'bar' } as const;
				},
			},
			{ ALT: () => this.SUBRULE(this.volta) },
			{ ALT: () => this.SUBRULE(this.navMarker) },
			{
				ALT: () => {
					const beat = this.SUBRULE(this.beat);
					return { type: 'beat', beat } as const;
				},
			},
		]);
	});

	private navMarker = this.RULE('navMarker', (): MusicItem => {
		return this.OR([
			{
				ALT: () => {
					const t = this.CONSUME(SegnoDir);
					return { type: 'nav', marker: 'segno', location: loc(t) } as const;
				},
			},
			{
				ALT: () => {
					const t = this.CONSUME(CodaDir);
					return { type: 'nav', marker: 'coda', location: loc(t) } as const;
				},
			},
			{
				ALT: () => {
					const t = this.CONSUME(FineDir);
					return { type: 'nav', marker: 'fine', location: loc(t) } as const;
				},
			},
		]);
	});

	private volta = this.RULE('volta', (): MusicItem => {
		const open = this.CONSUME(LBracket);
		const numbers: number[] = [Number(this.CONSUME(NumberLit).image)];
		this.MANY(() => {
			this.CONSUME(Comma);
			numbers.push(Number(this.CONSUME1(NumberLit).image));
		});
		this.CONSUME(RBracket);
		return { type: 'volta', numbers, location: loc(open) };
	});

	private beat = this.RULE('beat', (): RawBeat => {
		return this.OR([
			{ ALT: () => this.SUBRULE(this.tupletBeat) },
			{ ALT: () => this.SUBRULE(this.chordBeat) },
			{
				ALT: () => {
					const r = this.CONSUME(Rest);
					return { kind: 'rest', duration: this.SUBRULE(this.duration), location: loc(r) } as const;
				},
			},
			{
				ALT: () => {
					const a = this.CONSUME(NoteAtom);
					return {
						kind: 'note',
						atom: a.image,
						duration: this.SUBRULE1(this.duration),
						location: loc(a),
					} as const;
				},
			},
		]);
	});

	private chordBeat = this.RULE('chordBeat', (): RawBeat => {
		const open = this.CONSUME(LParen);
		const notes: RawNote[] = [];
		this.AT_LEAST_ONE(() => {
			const a = this.CONSUME(NoteAtom);
			notes.push({ atom: a.image, location: loc(a) });
		});
		this.CONSUME(RParen);
		return { kind: 'chord', notes, duration: this.SUBRULE(this.duration), location: loc(open) };
	});

	private tupletBeat = this.RULE('tupletBeat', (): RawBeat => {
		const t = this.CONSUME(Tuplet);
		this.CONSUME(LParen);
		const beats: RawBeat[] = [];
		this.AT_LEAST_ONE(() => beats.push(this.SUBRULE(this.beat)));
		this.CONSUME(RParen);
		return { kind: 'tuplet', n: Number(t.image.slice(1)), beats, location: loc(t) };
	});

	private duration = this.RULE('duration', (): Duration | null => {
		let result: Duration | null = null;
		this.OPTION(() => {
			this.CONSUME(Colon);
			const value = Number(this.CONSUME(NumberLit).image) as NoteValue;
			let dotted = false;
			this.OPTION1(() => {
				this.CONSUME(Dot);
				dotted = true;
			});
			result = { value, dotted };
		});
		return result;
	});
}

function unquote(image: string): string {
	return image.slice(1, -1).replace(/\\(.)/g, '$1');
}

export const parserInstance = new FretdownParser();

export type { Connector };
