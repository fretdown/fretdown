---
'@fretdown/render': patch
---

Fix technique rendering on the wrong string: fallback technique annotations (e.g. `p14`, and
articulations) were drawn at the bottom of the staff, landing on the 6th-string line
regardless of the note's actual string. They now sit above the staff. A bend immediately
followed by a release (`b…r…`) renders as a single bend-and-return arrow instead of a
floating `rel`.
