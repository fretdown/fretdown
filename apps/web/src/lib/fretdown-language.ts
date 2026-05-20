import { parse, validate } from '@fretdown/core';
import type * as monaco from 'monaco-editor';

type Monaco = typeof monaco;
type IMonarchLanguage = monaco.languages.IMonarchLanguage;
type IMarkerData = monaco.editor.IMarkerData;
type MarkerSeverity = monaco.MarkerSeverity;

export const FRETDOWN_LANGUAGE_ID = 'fretdown';

const monarchTokens: IMonarchLanguage = {
	defaultToken: '',
	tokenizer: {
		root: [
			[/#.*$/, 'comment'],
			[/@[a-zA-Z][\w-]*/, 'keyword'],
			[/^\s*[A-Za-z_][\w-]*(?=\s*:\s*$)/, 'type.identifier'],
			[/"(?:\\.|[^"\\])*"/, 'string'],
			[/\|:|:\||\|/, 'delimiter'],
			[/s\d+(?:f\d+|x)(?:[hpbr/\\]\d+)*(?:\.[a-z]+)*/, 'variable'],
			[/t\d+/, 'type'],
			[/:\d+\.?/, 'number'],
			[/\d+\/\d+/, 'number'],
			[/\d+/, 'number'],
			[/[A-G][#b]?\d+/, 'attribute.value'],
			[/[()[\]]/, '@brackets'],
			[/_/, 'constant'],
			[/[A-Za-z_][\w#-]*/, 'identifier'],
		],
	},
};

/** Registers the Fretdown language, a tokenizer, and a one-line config with Monaco. */
export function registerFretdown(monaco: Monaco): void {
	if (monaco.languages.getLanguages().some((l) => l.id === FRETDOWN_LANGUAGE_ID)) return;
	monaco.languages.register({ id: FRETDOWN_LANGUAGE_ID, extensions: ['.fd', '.fretdown'] });
	monaco.languages.setMonarchTokensProvider(FRETDOWN_LANGUAGE_ID, monarchTokens);
	monaco.languages.setLanguageConfiguration(FRETDOWN_LANGUAGE_ID, {
		comments: { lineComment: '#' },
		brackets: [
			['(', ')'],
			['[', ']'],
		],
		autoClosingPairs: [
			{ open: '(', close: ')' },
			{ open: '[', close: ']' },
			{ open: '"', close: '"' },
		],
	});
}

/** Runs the parser + validator and converts diagnostics into Monaco markers. */
export function computeMarkers(monaco: Monaco, source: string): IMarkerData[] {
	const { score, diagnostics } = parse(source);
	const all = [...diagnostics];
	if (score) all.push(...validate(score));

	const severity = (s: string): MarkerSeverity => {
		if (s === 'error') return monaco.MarkerSeverity.Error;
		if (s === 'warning') return monaco.MarkerSeverity.Warning;
		return monaco.MarkerSeverity.Info;
	};

	return all.map((d) => {
		const line = Math.max(1, d.location.line);
		const col = Math.max(1, d.location.col);
		return {
			severity: severity(d.severity),
			message: `${d.message} (${d.code})`,
			startLineNumber: line,
			startColumn: col,
			endLineNumber: line,
			endColumn: col + Math.max(1, d.location.length),
		};
	});
}
