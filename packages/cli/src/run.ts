import { type Diagnostic, parse, parseAsciiTab, validate } from '@fretdown/core';
import { renderToSVG } from '@fretdown/render';
import pc from 'picocolors';

export interface CommandResult {
	output: string;
	code: number;
}

function formatDiagnostic(filename: string, d: Diagnostic): string {
	const loc = pc.dim(`${filename}:${d.location.line}:${d.location.col}`);
	const tag =
		d.severity === 'error'
			? pc.red('error')
			: d.severity === 'warning'
				? pc.yellow('warning')
				: pc.blue('info');
	return `${loc} ${tag} ${pc.dim(`[${d.code}]`)} ${d.message}`;
}

/** Parses + validates source and returns a printable report with an exit code. */
export function runValidate(source: string, filename: string): CommandResult {
	const { score, diagnostics } = parse(source);
	const all = [...diagnostics];
	if (score) all.push(...validate(score));

	const errors = all.filter((d) => d.severity === 'error').length;
	const warnings = all.filter((d) => d.severity === 'warning').length;

	if (all.length === 0) {
		return { output: pc.green(`✓ ${filename} is valid`), code: 0 };
	}

	const lines = all.map((d) => formatDiagnostic(filename, d));
	const summary = `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${
		warnings === 1 ? '' : 's'
	}`;
	lines.push('', errors > 0 ? pc.red(summary) : pc.yellow(summary));
	return { output: lines.join('\n'), code: errors > 0 ? 1 : 0 };
}

export interface RenderOutcome {
	svg: string | null;
	report: CommandResult;
}

/** Renders source to SVG, returning the SVG (if parseable) and a diagnostic report. */
export function runRender(source: string, filename: string): RenderOutcome {
	const { score, diagnostics } = parse(source);
	const errors = diagnostics.filter((d) => d.severity === 'error');
	if (!score || errors.length > 0) {
		const lines = [pc.red(`✗ cannot render ${filename}`)];
		for (const d of errors) lines.push(formatDiagnostic(filename, d));
		return { svg: null, report: { output: lines.join('\n'), code: 1 } };
	}
	return { svg: renderToSVG(score), report: { output: '', code: 0 } };
}

/** Best-effort ASCII-tab → Fretdown conversion, emitting a stub with TODO markers. */
export function runConvert(asciiText: string, filename: string): CommandResult {
	const result = parseAsciiTab(asciiText);
	if (!result.fretdown) {
		return {
			output: pc.red(`✗ could not detect a tab block in ${filename}`),
			code: 1,
		};
	}

	const header = [
		'# Converted by `fretdown convert` — BEST-EFFORT, REVIEW REQUIRED',
		`# Confidence: ${(result.confidence * 100).toFixed(0)}%`,
		`# TODO: ${result.ambiguities.join(', ')}`,
		'# TODO: rhythm is approximated as eighth notes — fix durations and bar fill',
		'',
	].join('\n');

	return { output: header + result.fretdown, code: 0 };
}
