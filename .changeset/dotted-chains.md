---
'@fretdown/render': patch
---

Expand hammer/pull/slide chains on dotted notes too: a dotted-quarter pull-off like
`s2f15p14:4.` now renders as two slurred (dotted-eighth) noteheads instead of falling back to
a `p14` text label. Splitting a dotted duration into equal parts keeps the dot.
