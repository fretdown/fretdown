'use client';

import { TabPreview } from '@/components/TabPreview';
import { Button } from '@/components/ui/button';
import { EXAMPLE_SOURCE } from '@/lib/example';
import { FRETDOWN_LANGUAGE_ID, computeMarkers, registerFretdown } from '@/lib/fretdown-language';
import { decodeSource, encodeSource } from '@/lib/share';
import { parse, toMidi, toMusicXML } from '@fretdown/core';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { Check, Download, Share2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export function Playground() {
	const [source, setSource] = useState(EXAMPLE_SOURCE);
	const [shared, setShared] = useState(false);
	const monacoRef = useRef<Monaco | null>(null);
	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const hash = window.location.hash.slice(1);
		if (hash) {
			const decoded = decodeSource(hash);
			if (decoded) setSource(decoded);
		}
	}, []);

	const refreshMarkers = useCallback((value: string) => {
		const monaco = monacoRef.current;
		const editor = editorRef.current;
		if (!monaco || !editor) return;
		const model = editor.getModel();
		if (!model) return;
		monaco.editor.setModelMarkers(model, FRETDOWN_LANGUAGE_ID, computeMarkers(monaco, value));
	}, []);

	const handleMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;
		monacoRef.current = monaco;
		registerFretdown(monaco);
		monaco.editor.setModelLanguage(editor.getModel()!, FRETDOWN_LANGUAGE_ID);
		refreshMarkers(editor.getValue());
	};

	const handleShare = () => {
		const url = `${window.location.origin}${window.location.pathname}#${encodeSource(source)}`;
		void navigator.clipboard.writeText(url);
		window.history.replaceState(null, '', `#${encodeSource(source)}`);
		setShared(true);
		setTimeout(() => setShared(false), 1500);
	};

	const [exportError, setExportError] = useState<string | null>(null);

	const handleExport = (format: 'midi' | 'musicxml') => {
		const { score, diagnostics } = parse(source);
		if (!score || diagnostics.some((d) => d.severity === 'error')) {
			setExportError('Fix the errors in the editor before exporting.');
			setTimeout(() => setExportError(null), 2500);
			return;
		}
		const slug = (score.metadata.title ?? 'tab').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'tab';
		let blob: Blob;
		let ext: string;
		if (format === 'midi') {
			const bytes = toMidi(score);
			const buffer = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			blob = new Blob([buffer], { type: 'audio/midi' });
			ext = 'mid';
		} else {
			blob = new Blob([toMusicXML(score)], { type: 'application/vnd.recordare.musicxml+xml' });
			ext = 'musicxml';
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${slug}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			<div className="flex items-center justify-between border-b border-border px-4 py-2">
				<span className="text-sm text-muted-foreground">
					{exportError ?? 'Edit Fretdown on the left; the tab renders live on the right.'}
				</span>
				<div className="flex items-center gap-2">
					<Button size="sm" variant="outline" onClick={() => handleExport('midi')}>
						<Download className="h-4 w-4" />
						MIDI
					</Button>
					<Button size="sm" variant="outline" onClick={() => handleExport('musicxml')}>
						<Download className="h-4 w-4" />
						MusicXML
					</Button>
					<Button size="sm" variant="outline" onClick={handleShare}>
						{shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
						{shared ? 'Copied link' : 'Share'}
					</Button>
				</div>
			</div>
			<PanelGroup direction="horizontal" className="flex-1">
				<Panel defaultSize={45} minSize={25}>
					<Editor
						height="100%"
						defaultLanguage={FRETDOWN_LANGUAGE_ID}
						theme="vs-dark"
						value={source}
						onMount={handleMount}
						onChange={(value) => {
							const next = value ?? '';
							setSource(next);
							refreshMarkers(next);
						}}
						options={{
							fontSize: 14,
							minimap: { enabled: false },
							lineNumbers: 'on',
							scrollBeyondLastLine: false,
							wordWrap: 'on',
						}}
					/>
				</Panel>
				<PanelResizeHandle className="w-1.5 bg-border transition-colors hover:bg-accent" />
				<Panel defaultSize={55} minSize={30}>
					<div className="h-full overflow-auto bg-muted/30 p-4">
						<TabPreview source={source} />
					</div>
				</Panel>
			</PanelGroup>
		</div>
	);
}
