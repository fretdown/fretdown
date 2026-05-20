'use client';

import { TabPreview } from '@/components/TabPreview';
import { Button } from '@/components/ui/button';
import { EXAMPLE_SOURCE } from '@/lib/example';
import { FRETDOWN_LANGUAGE_ID, computeMarkers, registerFretdown } from '@/lib/fretdown-language';
import { decodeSource, encodeSource } from '@/lib/share';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { Check, Share2 } from 'lucide-react';
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

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			<div className="flex items-center justify-between border-b border-border px-4 py-2">
				<span className="text-sm text-muted-foreground">
					Edit Fretdown on the left; the tab renders live on the right.
				</span>
				<Button size="sm" variant="outline" onClick={handleShare}>
					{shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
					{shared ? 'Copied link' : 'Share'}
				</Button>
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
