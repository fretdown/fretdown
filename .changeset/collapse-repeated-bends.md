---
'@fretdown/render': patch
---

Collapse repeated bends to a single arrow: a note like `s3f9b11b11r9p7` no longer renders
"Full Full" — consecutive bends to the same fret fold into one bend-and-release arrow, so
the bend reads cleanly alongside the trailing pull-off.
