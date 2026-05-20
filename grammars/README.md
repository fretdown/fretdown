# Fretdown editor grammars

Portable syntax-highlighting grammars for the Fretdown notation format.

## `fretdown.tmLanguage.json`

A [TextMate grammar](https://macromates.com/manual/en/language_grammars) (scope
`source.fretdown`) understood by VS Code, GitHub Linguist, Sublime Text, and most editors
that support TextMate-style highlighting.

### Use it in VS Code

Create a tiny extension (or drop this into one you already have):

```jsonc
// package.json (contributes section)
"contributes": {
  "languages": [
    { "id": "fretdown", "extensions": [".fd", ".fretdown"], "configuration": "./language-configuration.json" }
  ],
  "grammars": [
    { "language": "fretdown", "scopeName": "source.fretdown", "path": "./fretdown.tmLanguage.json" }
  ]
}
```

```jsonc
// language-configuration.json
{
  "comments": { "lineComment": "#" },
  "brackets": [["(", ")"], ["[", "]"]],
  "autoClosingPairs": [["(", ")"], ["[", "]"], ["\"", "\""]]
}
```

The web playground (`apps/web`) uses an equivalent Monaco/Monarch tokenizer in
`src/lib/fretdown-language.ts`, plus live validator diagnostics. This file is the portable
version for everything outside the playground.
