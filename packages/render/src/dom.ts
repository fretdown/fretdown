import { JSDOM } from 'jsdom';

export interface HeadlessContainer {
	element: HTMLDivElement;
	html: () => string;
}

/**
 * Creates an isolated jsdom container suitable for VexFlow's SVG backend.
 * jsdom does not implement SVG text metrics, so we stub them; this only
 * affects sub-pixel text placement, not the structural SVG output.
 */
export function createContainer(): HeadlessContainer {
	const dom = new JSDOM('<!DOCTYPE html><body><div id="fretdown-root"></div></body>');
	const win = dom.window as unknown as {
		document: Document;
		SVGElement: { prototype: Record<string, unknown> };
	};

	const proto = win.SVGElement.prototype;
	proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });
	proto.getComputedTextLength = () => 10;

	// VexFlow's SVG backend reaches for a global document/window.
	const g = globalThis as unknown as { document?: unknown; window?: unknown };
	g.document = win.document;
	g.window = win;

	const element = win.document.getElementById('fretdown-root') as unknown as HTMLDivElement;
	return {
		element,
		html: () => element.innerHTML,
	};
}
