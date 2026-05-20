import {
	type AsciiResult,
	type Diagnostic,
	parse,
	parseAsciiTab,
	scoreSchema,
	serialize,
	toMidi,
	toMusicXML,
	validate,
} from '@fretdown/core';
import { renderToSVG } from '@fretdown/render';

export interface ValidateResult {
	ok: boolean;
	diagnostics: Diagnostic[];
}

export function validateFretdown(source: string): ValidateResult {
	const { score, diagnostics } = parse(source);
	const all = [...diagnostics];
	if (score) all.push(...validate(score));
	return { ok: all.every((d) => d.severity !== 'error'), diagnostics: all };
}

export interface RenderResult {
	svg: string | null;
	diagnostics: Diagnostic[];
}

export function renderFretdownToSvg(source: string): RenderResult {
	const { score, diagnostics } = parse(source);
	if (!score) return { svg: null, diagnostics };
	return { svg: renderToSVG(score), diagnostics };
}

export interface ConvertResult {
	fretdown: string | null;
	error: string | null;
}

export function convertIrToFretdown(ir: unknown): ConvertResult {
	const result = scoreSchema.safeParse(ir);
	if (!result.success) {
		return {
			fretdown: null,
			error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
		};
	}
	return { fretdown: serialize(result.data), error: null };
}

export function importAsciiTab(text: string): AsciiResult {
	return parseAsciiTab(text);
}

export interface ExportResult {
	/** MusicXML text, or base64-encoded bytes for MIDI. */
	data: string | null;
	encoding: 'utf8' | 'base64';
	diagnostics: Diagnostic[];
}

export function exportFretdown(source: string, format: 'midi' | 'musicxml'): ExportResult {
	const { score, diagnostics } = parse(source);
	if (!score) return { data: null, encoding: 'utf8', diagnostics };
	if (format === 'midi') {
		return {
			data: Buffer.from(toMidi(score)).toString('base64'),
			encoding: 'base64',
			diagnostics,
		};
	}
	return { data: toMusicXML(score), encoding: 'utf8', diagnostics };
}
