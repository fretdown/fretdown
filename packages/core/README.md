# @fretdown/core

The parser, intermediate representation (IR), validator, and serializer for
[Fretdown](../../README.md).

## API

```ts
import { parse, validate, serialize, parseAsciiTab } from '@fretdown/core';

const { score, diagnostics } = parse(source); // ParseResult
if (score) {
  const problems = validate(score);            // Diagnostic[]
  const canonical = serialize(score);          // canonical .fd text
}
```

| Export | Description |
| --- | --- |
| `parse(source)` | Lex + parse Fretdown text into a `Score` (plus lexer/parser diagnostics). |
| `validate(score)` | Walk the IR and return structured `Diagnostic[]` (fret/string range, measure fill, `@arrange` references, tuning pitches, articulations). |
| `serialize(score)` | Emit canonical `.fd` text with explicit durations (round-trips through `parse`). |
| `parseAsciiTab(text)` | Best-effort import of legacy ASCII tab into a partial `Score` with confidence + ambiguity flags. |
| `decodeNoteAtom(atom)` | Decode a single note lexeme (e.g. `s3f5h7.vib`). |
| `parsePitch` / `isValidPitch` | Scientific-pitch helpers. |
| `INSTRUMENTS`, `getInstrument` | Instrument defaults (tuning, fret count). |

## Diagnostics

Diagnostics share TypeScript's diagnostic shape:

```ts
{ severity: 'error' | 'warning' | 'info', code: string, message: string,
  location: { line: number, col: number, length: number } }
```

Built with [Chevrotain](https://chevrotain.io) (lexer + parser) and
[Zod](https://zod.dev) (IR schemas). See the [spec](../../spec) for the notation.
