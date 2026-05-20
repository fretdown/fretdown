---
'@fretdown/core': patch
---

ASCII import now handles multi-system tabs: instead of keeping only the single longest block,
it concatenates every stacked system (line groups of the same string count, separated by
blank lines) into one continuous piece. Adds a `multi-system` ambiguity flag.
