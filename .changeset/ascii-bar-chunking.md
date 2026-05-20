---
'@fretdown/core': patch
---

ASCII-tab import now produces valid measures: it chunks notes into bar-sized measures
(padding the last bar with rests) instead of trusting ASCII barlines, which often left
measures that didn't fill the time signature. It also trims each line to the bar-delimited
region, so trailing annotations like `(6x)` are no longer misread as notes.
