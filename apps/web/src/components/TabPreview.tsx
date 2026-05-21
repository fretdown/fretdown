'use client';

import { type Diagnostic, expandRepeats, parse, validate } from '@fretdown/core';
import { computeLayout, renderInto } from '@fretdown/render/browser';
import { useEffect, useMemo, useRef, useState } from 'react';

/** Where the playback cursor currently sits, in measure-relative terms. */
export interface PlaybackCursor {
	measureIndex: number;
	/** 0–1 progress through the current measure. */
	progress: number;
	/** When soloing a track, only highlight that track's measures. */
	trackIndex?: number;
}

export interface TabPreviewProps {
	source: string;
	/** Maximum width; the tab shrinks to fit narrower containers. */
	width?: number;
	measuresPerLine?: number;
	cursor?: PlaybackCursor | null;
}

export function TabPreview({
	source,
	width = 900,
	measuresPerLine = 2,
	cursor = null,
}: TabPreviewProps) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const ref = useRef<HTMLDivElement>(null);
	const [available, setAvailable] = useState<number>(width);

	const { score, errors } = useMemo(() => {
		const { score, diagnostics } = parse(source);
		const all: Diagnostic[] = [...diagnostics];
		if (score) all.push(...validate(score));
		return { score, errors: all.filter((d) => d.severity === 'error') };
	}, [source]);

	// Reflow the tab to fit the container: shrink to its width, dropping to one
	// measure per line on narrow screens. The cursor overlay below uses the same
	// values so its boxes line up with the rendered SVG.
	const renderWidth = Math.max(280, Math.min(width, Math.floor(available)));
	const lines = renderWidth < 520 ? 1 : measuresPerLine;

	// Expand repeats so a `|: … :|xN` riff is shown (and measured) as N literal repetitions.
	const playable = useMemo(() => (score ? expandRepeats(score) : null), [score]);

	const layout = useMemo(
		() =>
			playable ? computeLayout(playable, { width: renderWidth, measuresPerLine: lines }) : null,
		[playable, renderWidth, lines],
	);

	// Track the container's width so the tab reflows to fit any screen.
	useEffect(() => {
		const el = wrapRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w && w > 0) setAvailable(w);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.innerHTML = '';
		if (!playable) return;
		try {
			renderInto(el, playable, { width: renderWidth, measuresPerLine: lines });
		} catch (err) {
			el.innerHTML = `<p class="text-sm text-red-500">Render error: ${
				err instanceof Error ? err.message : String(err)
			}</p>`;
		}
	}, [playable, renderWidth, lines]);

	const activeBoxes =
		layout && cursor
			? layout.measures.filter(
					(m) =>
						m.measureIndex === cursor.measureIndex &&
						(cursor.trackIndex === undefined || m.trackIndex === cursor.trackIndex),
				)
			: [];

	return (
		<div ref={wrapRef} className="w-full space-y-3">
			{errors.length > 0 && (
				<ul className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
					{errors.map((e, i) => (
						<li key={`${e.code}-${i}`} className="break-words font-mono">
							line {e.location.line}:{e.location.col} — {e.message}
						</li>
					))}
				</ul>
			)}
			<div className="overflow-x-auto rounded-md bg-white p-2">
				<div className="relative inline-block align-top">
					<div ref={ref} className="[&_svg]:h-auto [&_svg]:max-w-none" />
					{cursor && activeBoxes.length > 0 && (
						<div className="pointer-events-none absolute inset-0">
							{activeBoxes.map((m) => (
								<div
									key={`${m.trackIndex}-${m.measureIndex}`}
									className="absolute rounded-sm bg-accent/10 ring-1 ring-accent/40"
									style={{ left: m.x, top: m.y, width: m.width, height: m.height }}
								>
									<div
										className="absolute top-0 bottom-0 w-0.5 bg-accent"
										style={{
											// Sweep from where notes begin (after clef/time sig), not the box edge.
											left: Math.min(
												m.width,
												m.noteX - m.x + (m.x + m.width - m.noteX) * cursor.progress,
											),
										}}
									/>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
