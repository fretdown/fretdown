'use client';

import { type PlaybackCursor, TabPreview } from '@/components/TabPreview';
import { Button } from '@/components/ui/button';
import { EXAMPLE_SOURCE } from '@/lib/example';
import { FRETDOWN_LANGUAGE_ID, computeMarkers, registerFretdown } from '@/lib/fretdown-language';
import { defaultProgram } from '@/lib/gm';
import { TabPlayer, buildTimeline } from '@/lib/playback';
import { SAMPLES } from '@/lib/samples';
import { decodeSource, encodeSource } from '@/lib/share';
import { expandRepeats, parse, parseAsciiTab, toMidi, toMusicXML } from '@fretdown/core';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { Check, Download, FileInput, Play, Share2, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export function Playground() {
	const [source, setSource] = useState(EXAMPLE_SOURCE);
	const [shared, setShared] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);
	const [cursor, setCursor] = useState<PlaybackCursor | null>(null);
	// Which track to play: 'all' (every track together) or a single track index (solo).
	const [selected, setSelected] = useState<number | 'all'>('all');
	const [importOpen, setImportOpen] = useState(false);
	const [asciiText, setAsciiText] = useState('');
	const [importError, setImportError] = useState<string | null>(null);
	const monacoRef = useRef<Monaco | null>(null);
	const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
	const playerRef = useRef<TabPlayer | null>(null);
	if (!playerRef.current) playerRef.current = new TabPlayer();

	const parsed = useMemo(() => parse(source), [source]);
	const tracks = useMemo(() => parsed.score?.tracks ?? [], [parsed]);

	// Reset the selection if the chosen track no longer exists after an edit.
	useEffect(() => {
		setSelected((prev) => (prev === 'all' || prev < tracks.length ? prev : 'all'));
	}, [tracks.length]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const hash = window.location.hash.slice(1);
		if (hash) {
			const decoded = decodeSource(hash);
			if (decoded) setSource(decoded);
		}
	}, []);

	useEffect(() => () => playerRef.current?.stop(), []);

	const flash = (message: string) => {
		setNotice(message);
		setTimeout(() => setNotice(null), 2500);
	};

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

	const playablesScore = () => {
		if (!parsed.score || parsed.diagnostics.some((d) => d.severity === 'error')) {
			flash('Fix the errors in the editor first.');
			return null;
		}
		return parsed.score;
	};

	const handlePlay = async () => {
		if (playing) {
			playerRef.current?.stop();
			setPlaying(false);
			setCursor(null);
			return;
		}
		const score = playablesScore();
		if (!score) return;
		const onlyTrack = selected === 'all' ? undefined : selected;
		// Expand repeats so playback (and the cursor) run through every repetition.
		const timeline = buildTimeline(expandRepeats(score), onlyTrack);
		if (timeline.events.length === 0 || timeline.barSeconds === 0) {
			flash('Nothing to play yet.');
			return;
		}
		setPlaying(true);
		await playerRef.current?.play(
			timeline,
			// Each track keeps its instrument's GM program; only the soloed track has events.
			tracks.map((t) => defaultProgram(t.instrument)),
			(elapsed) => {
				const idx = Math.min(Math.floor(elapsed / timeline.barSeconds), timeline.measureCount - 1);
				const progress = Math.min(
					1,
					Math.max(0, (elapsed - idx * timeline.barSeconds) / timeline.barSeconds),
				);
				setCursor({ measureIndex: Math.max(0, idx), progress, trackIndex: onlyTrack });
			},
			() => {
				setPlaying(false);
				setCursor(null);
			},
		);
	};

	const handleSelect = (value: number | 'all') => {
		setSelected(value);
		// Stop so the change is obvious; the next Play uses the new selection.
		if (playing) {
			playerRef.current?.stop();
			setPlaying(false);
			setCursor(null);
		}
	};

	const currentSample = SAMPLES.findIndex((s) => s.source === source);

	const loadIntoEditor = (next: string) => {
		playerRef.current?.stop();
		setPlaying(false);
		setCursor(null);
		setSelected('all');
		setSource(next);
		refreshMarkers(next);
		window.history.replaceState(null, '', window.location.pathname);
	};

	const loadSample = (index: number) => {
		const sample = SAMPLES[index];
		if (sample) loadIntoEditor(sample.source);
	};

	const handleImport = () => {
		const result = parseAsciiTab(asciiText);
		if (!result.fretdown) {
			setImportError('Couldn’t find a tab block. Paste lines like  e|--0--3--5--|');
			return;
		}
		const pct = Math.round(result.confidence * 100);
		const header = [
			`# Imported from ASCII tab — approximate (${pct}% confidence)`,
			`# Review: ${result.ambiguities.join(', ')}`,
			'',
		].join('\n');
		loadIntoEditor(header + result.fretdown);
		setImportOpen(false);
		setAsciiText('');
		setImportError(null);
		flash(`Imported ASCII tab (${pct}% confidence) — rhythm is approximate, review it.`);
	};

	const handleExport = (format: 'midi' | 'musicxml') => {
		const score = playablesScore();
		if (!score) return;
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
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
				<div className="flex items-center gap-2">
					<label className="flex items-center gap-1.5 text-sm">
						<span className="text-muted-foreground">Sample</span>
						<select
							aria-label="Load a sample"
							className="rounded border border-border bg-background px-2 py-1 text-sm"
							value={currentSample === -1 ? 'custom' : String(currentSample)}
							onChange={(e) => {
								if (e.target.value !== 'custom') loadSample(Number(e.target.value));
							}}
						>
							{currentSample === -1 && <option value="custom">Custom…</option>}
							{SAMPLES.map((s, i) => (
								<option key={s.name} value={i}>
									{s.name}
								</option>
							))}
						</select>
					</label>
					<span className="hidden text-sm text-muted-foreground sm:inline">
						{notice ?? 'Edit on the left; the tab renders live on the right.'}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" onClick={handlePlay}>
						{playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
						{playing ? 'Stop' : 'Play'}
					</Button>
					{tracks.length > 0 && (
						<select
							aria-label="Instrument to play"
							className="rounded border border-border bg-background px-2 py-1 text-sm"
							value={selected === 'all' ? 'all' : String(selected)}
							onChange={(e) =>
								handleSelect(e.target.value === 'all' ? 'all' : Number(e.target.value))
							}
						>
							<option value="all">All instruments</option>
							{tracks.map((track, i) => (
								<option key={`${track.name}-${i}`} value={i}>
									{track.name}
								</option>
							))}
						</select>
					)}
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							setImportError(null);
							setImportOpen(true);
						}}
					>
						<FileInput className="h-4 w-4" />
						Import
					</Button>
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
						<TabPreview source={source} cursor={cursor} />
					</div>
				</Panel>
			</PanelGroup>

			{importOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<button
						type="button"
						aria-label="Close import dialog"
						className="absolute inset-0 cursor-default"
						onClick={() => setImportOpen(false)}
					/>
					<div className="relative w-full max-w-2xl rounded-lg border border-border bg-card p-5 shadow-xl">
						<h2 className="text-lg font-semibold">Import ASCII tab</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Paste a legacy ASCII guitar/bass tab. Conversion is best-effort — the rhythm is
							approximated and tuning is guessed, so review the result.
						</p>
						<textarea
							className="mt-3 h-56 w-full resize-none whitespace-pre rounded border border-border bg-background p-2 font-mono text-sm leading-snug"
							style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
							wrap="off"
							spellCheck={false}
							placeholder={
								'e|--0--3--5--3--0-----------|\nB|-----------------1--3--1--|\nG|--------------------------|\nD|--------------------------|\nA|--------------------------|\nE|--------------------------|'
							}
							value={asciiText}
							onChange={(e) => setAsciiText(e.target.value)}
						/>
						{importError && <p className="mt-2 text-sm text-red-500">{importError}</p>}
						<div className="mt-4 flex justify-end gap-2">
							<Button size="sm" variant="outline" onClick={() => setImportOpen(false)}>
								Cancel
							</Button>
							<Button size="sm" onClick={handleImport} disabled={asciiText.trim().length === 0}>
								Convert &amp; insert
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
