'use client';

import { type Diagnostic, parse, validate } from '@fretdown/core';
import { computeLayout, renderInto } from '@fretdown/render/browser';
import { useEffect, useMemo, useRef } from 'react';

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
	width?: number;
	measuresPerLine?: number;
	cursor?: PlaybackCursor | null;
}

export function TabPreview({
	source,
	width = 820,
	measuresPerLine = 2,
	cursor = null,
}: TabPreviewProps) {
	const ref = useRef<HTMLDivElement>(null);

	const { score, errors } = useMemo(() => {
		const { score, diagnostics } = parse(source);
		const all: Diagnostic[] = [...diagnostics];
		if (score) all.push(...validate(score));
		return { score, errors: all.filter((d) => d.severity === 'error') };
	}, [source]);

	const layout = useMemo(
		() => (score ? computeLayout(score, { width, measuresPerLine }) : null),
		[score, width, measuresPerLine],
	);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.innerHTML = '';
		if (!score) return;
		try {
			renderInto(el, score, { width, measuresPerLine });
		} catch (err) {
			el.innerHTML = `<p class="text-sm text-red-500">Render error: ${
				err instanceof Error ? err.message : String(err)
			}</p>`;
		}
	}, [score, width, measuresPerLine]);

	const activeBoxes =
		layout && cursor
			? layout.measures.filter(
					(m) =>
						m.measureIndex === cursor.measureIndex &&
						(cursor.trackIndex === undefined || m.trackIndex === cursor.trackIndex),
				)
			: [];

	return (
		<div className="space-y-3">
			{errors.length > 0 && (
				<ul className="space-y-1 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
					{errors.map((e, i) => (
						<li key={`${e.code}-${i}`} className="font-mono">
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
										style={{ left: Math.min(m.width, m.width * cursor.progress) }}
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
