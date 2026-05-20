# Formal grammar (EBNF)

This is the reference grammar for Fretdown v0.1. It is descriptive; the canonical
implementation is `@fretdown/core` (a Chevrotain lexer + parser). Whitespace within a line
and `#`-to-end-of-line comments are insignificant. Newlines terminate directive lines and
section labels; elsewhere they are insignificant.

```ebnf
document      = header , { track } ;

header        = { metaDirective | arrangeDirective } ;

metaDirective = "@title"  string
              | "@artist" string
              | "@album"  string
              | "@tempo"  integer
              | "@time"   fraction
              | "@key"    word
              | "@capo"   integer ;

arrangeDirective = "@arrange" , label , { label } ;

track         = "@track" , ( word | string ) ,
                { trackDirective } ,
                { section } ;

trackDirective = "@instrument" word
               | "@tuning" , pitch , { pitch }
               | "@frets" integer
               | "@capo"  integer ;

section       = label , ":" , { sectionItem } ;
sectionItem   = navMarker | measureGroup ;
navMarker     = "@segno" | "@coda" | "@fine" ;

measureGroup  = [ "|:" ] , measure , { measure } , [ "|" | repeatClose ] ;
repeatClose   = ":|" , [ "x" integer ] ;
measure       = [ volta ] , "|" , { beat } ;
volta         = "[" , integer , { "," , integer } , "]" ;

beat          = ( note | chord | rest ) , [ duration ] ;
chord         = "(" , note , { note } , ")" ;
rest          = "_" ;
tuplet        = "t" integer , "(" , beat , { beat } , ")" ;

note          = stringRef , fretChain , { articulation } ;
stringRef     = "s" , integer ;
fretChain     = ( fret | "x" ) , { connector , integer } ;
fret          = "f" , integer ;
connector     = "h" | "p" | "/" | "\" | "b" | "r" ;
articulation  = "." , artKeyword ;
artKeyword    = "pm" | "vib" | "harm" | "ghost" | "slap"
              | "pop" | "tap" | "let" | "stac" ;

duration      = ":" , noteValue , [ "." ] ;
noteValue     = "1" | "2" | "4" | "8" | "16" | "32" ;

label         = letter , { letter | digit | "_" | "-" } ;
word          = letter , { letter | digit | "_" | "-" | "#" } ;
pitch         = ( "A" … "G" ) , [ "#" | "b" ] , integer ;
fraction      = integer , "/" , integer ;
string        = '"' , { character } , '"' ;
integer       = digit , { digit } ;
```

## Lexical notes

A **note atom** (`stringRef fretChain articulation*`) is lexed as a single token and then
decoded by a dedicated, separately tested routine; this keeps the document grammar small
and free of single-letter token ambiguities. See `DECISIONS.md`.

Token disambiguation relies on a note atom always beginning with `s` followed by a digit,
so identifiers (section labels, track names, instrument ids, keys, pitches) never collide
with notes.
