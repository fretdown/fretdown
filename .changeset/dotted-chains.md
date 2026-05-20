---
'@fretdown/render': patch
---

Expand more hammer/pull/slide chains into real noteheads instead of text labels:

- **Dotted notes** — a dotted-quarter pull-off like `s2f15p14:4.` now renders as two slurred
  (dotted-eighth) noteheads. Splitting a dotted duration into equal parts keeps the dot.
- **Odd chain lengths** — a chain like `s4f7/9\7` (length 3) is drawn as a tuplet (3 in the
  space of 2) with the slide lines, rather than falling back to a `/9\7` label.
