# @fretdown/render

Renders a Fretdown [`Score`](../core) to SVG tablature using
[VexFlow](https://www.vexflow.com).

## Node

```ts
import { parse } from '@fretdown/core';
import { renderToSVG } from '@fretdown/render';

const { score } = parse(source);
const svg = renderToSVG(score!, { width: 900, measuresPerLine: 2 });
```

`renderToSVG` runs headlessly via a stubbed jsdom DOM and returns an SVG string.

## Browser

The Node entry pulls in jsdom, so the browser build is a separate, jsdom-free entry:

```ts
import { renderInto } from '@fretdown/render/browser';

renderInto(divElement, score, { width: 820 });
```

`renderInto(element, score, options)` draws into a real DOM element.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `width` | `900` | Total SVG width in pixels. |
| `measuresPerLine` | `4` | Measures per row. |
| `scale` | `1` | Uniform scale factor. |

Supports 4- and 6-line staves (from the tuning), durations and dots, chords, rests, time
signatures, tempo/title headers, bends, and technique annotations (hammer/pull/slide/palm
mute). A connector chain such as `s5f2h3` renders the first fret with a technique
annotation; see `DECISIONS.md` for this v1 limitation.
