import { z } from 'zod';

export const locationSchema = z.object({
	line: z.number().int().nonnegative(),
	col: z.number().int().nonnegative(),
	length: z.number().int().nonnegative(),
});
export type Location = z.infer<typeof locationSchema>;

export const noteValueSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(4),
	z.literal(8),
	z.literal(16),
	z.literal(32),
]);
export type NoteValue = z.infer<typeof noteValueSchema>;

export const durationSchema = z.object({
	value: noteValueSchema,
	dotted: z.boolean(),
});
export type Duration = z.infer<typeof durationSchema>;

export const connectorSchema = z.enum(['h', 'p', '/', '\\', 'b', 'r']);
export type Connector = z.infer<typeof connectorSchema>;

export const fretEventSchema = z.object({
	connector: connectorSchema,
	fret: z.number().int(),
});
export type FretEvent = z.infer<typeof fretEventSchema>;

export const noteSchema = z.object({
	string: z.number().int(),
	dead: z.boolean(),
	fret: z.number().int().nullable(),
	events: z.array(fretEventSchema),
	articulations: z.array(z.string()),
	location: locationSchema,
});
export type Note = z.infer<typeof noteSchema>;

export type Beat =
	| { kind: 'note'; note: Note; duration: Duration; location: Location }
	| { kind: 'chord'; notes: Note[]; duration: Duration; location: Location }
	| { kind: 'rest'; duration: Duration; location: Location }
	| { kind: 'tuplet'; n: number; beats: Beat[]; location: Location };

export const beatSchema: z.ZodType<Beat> = z.lazy(() =>
	z.discriminatedUnion('kind', [
		z.object({
			kind: z.literal('note'),
			note: noteSchema,
			duration: durationSchema,
			location: locationSchema,
		}),
		z.object({
			kind: z.literal('chord'),
			notes: z.array(noteSchema),
			duration: durationSchema,
			location: locationSchema,
		}),
		z.object({
			kind: z.literal('rest'),
			duration: durationSchema,
			location: locationSchema,
		}),
		z.object({
			kind: z.literal('tuplet'),
			n: z.number().int().min(2),
			beats: z.array(beatSchema),
			location: locationSchema,
		}),
	]),
);

export const measureSchema = z.object({
	beats: z.array(beatSchema),
	volta: z.array(z.number().int()).optional(),
	repeatStart: z.boolean().optional(),
	repeatEnd: z.object({ times: z.number().int().min(1) }).optional(),
	location: locationSchema,
});
export type Measure = z.infer<typeof measureSchema>;

export const navMarkerSchema = z.object({
	kind: z.literal('nav'),
	marker: z.enum(['segno', 'coda', 'fine']),
	location: locationSchema,
});
export type NavMarker = z.infer<typeof navMarkerSchema>;

export type SectionItem = Measure | NavMarker;

export const sectionSchema = z.object({
	label: z.string(),
	items: z.array(z.union([measureSchema, navMarkerSchema])),
	location: locationSchema,
});
export type Section = z.infer<typeof sectionSchema>;

export const trackSchema = z.object({
	name: z.string(),
	instrument: z.string().optional(),
	tuning: z.array(z.string()),
	frets: z.number().int().positive(),
	capo: z.number().int().nonnegative(),
	sections: z.array(sectionSchema),
	location: locationSchema,
});
export type Track = z.infer<typeof trackSchema>;

export const timeSignatureSchema = z.object({
	numerator: z.number().int().positive(),
	denominator: z.number().int().positive(),
});
export type TimeSignature = z.infer<typeof timeSignatureSchema>;

export const metadataSchema = z.object({
	title: z.string().optional(),
	artist: z.string().optional(),
	album: z.string().optional(),
	tempo: z.number().int().positive().optional(),
	time: timeSignatureSchema,
	key: z.string().optional(),
	capo: z.number().int().nonnegative(),
});
export type Metadata = z.infer<typeof metadataSchema>;

export const scoreSchema = z.object({
	metadata: metadataSchema,
	arrange: z.array(z.string()).optional(),
	tracks: z.array(trackSchema),
});
export type Score = z.infer<typeof scoreSchema>;

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
	severity: Severity;
	code: string;
	message: string;
	location: Location;
}

export interface ParseResult {
	score: Score | null;
	diagnostics: Diagnostic[];
}
