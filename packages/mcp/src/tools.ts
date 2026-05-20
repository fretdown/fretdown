import { type Diagnostic, parse, scoreSchema, serialize, validate } from '@fretdown/core';
import { renderToSVG } from '@fretdown/render';
import { type AsciiResult, parseAsciiTab } from './ascii.js';

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
