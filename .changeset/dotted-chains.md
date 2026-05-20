---
'@fretdown/render': patch
---

Expand more hammer/pull/slide chains into real noteheads instead of text labels:

- **Dotted notes** — a dotted-quarter pull-off like `s2f15p14:4.` now renders as two slurred
  (dotted-eighth) noteheads. Splitting a dotted duration into equal parts keeps the dot.
- **Odd chain lengths** — a chain like `s4f7/9\7` (length 3) is drawn as a tuplet (3 in the
  space of 2) with the slide lines, rather than falling back to a `/9\7` label.
- **Mixed bend + transition chains** — in `s3f9b11b11r9p7`, the bends/releases draw as Bend
  arrows on the notehead and the trailing pull-off becomes a real tie to fret 7, instead of
  leaving a `p7` text label. Bends/releases decorate a notehead; only transitions add one.
- **Chord chains** — a slide (or hammer/pull) inside a chord, e.g. `(s5f17\16 s6f15\14)`,
  expands into two stacked noteheads with one slide line per string, instead of `\14`/`\16`
  labels.
