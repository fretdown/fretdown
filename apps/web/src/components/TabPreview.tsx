'use client';

import { type Diagnostic, parse, validate } from '@fretdown/core';
import { renderInto } from '@fretdown/render/browser';
import { useEffect, useMemo, useRef } from 'react';

export interface TabPreviewProps {
	source: string;
	width?: number;
	measuresPerLine?: number;
}

export function TabPreview({ source, width = 820, measuresPerLine = 2 }: TabPreviewProps) {
	const ref = useRef<HTMLDivElement>(null);

	const { score, errors } = useMemo(() => {
		const { score, diagnostics } = parse(source);
		const all: Diagnostic[] = [...diagnostics];
		if (score) all.push(...validate(score));
		return { score, errors: all.filter((d) => d.severity === 'error') };
	}, [source]);

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
			<div
				ref={ref}
				className="overflow-x-auto rounded-md bg-white p-2 [&_svg]:h-auto [&_svg]:max-w-none"
			/>
		</div>
	);
}
