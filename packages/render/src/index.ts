import type { Score } from '@fretdown/core';
import { createContainer } from './dom.js';
import { type RenderOptions, renderInto } from './draw.js';

export type { MeasureBox, RenderOptions, ScoreLayout } from './draw.js';
export { computeLayout, renderInto } from './draw.js';

/** Renders a score to a standalone SVG string. Node-only (uses a headless DOM). */
export function renderToSVG(score: Score, options: RenderOptions = {}): string {
	const container = createContainer();
	renderInto(container.element, score, options);
	return container.html();
}
