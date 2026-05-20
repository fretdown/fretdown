---
'@fretdown/render': patch
---

`computeLayout` measure boxes now include `noteX` — the x where notes begin, after the clef
and time signature — so a playback cursor can start at the first note instead of the bar's
left edge.
