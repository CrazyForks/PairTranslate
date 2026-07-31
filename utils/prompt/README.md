# Prompts

Prompts are static TypeScript, not user configuration. Each one is a pure
function of a typed context to a string, so prompt text is type-checked and
unit-testable, and there is no template language to parse at runtime.

## Layout

| Path | Role |
| --- | --- |
| `id.ts` | `PromptId` union and `PromptOutputMap`. A leaf module, so consumers can import prompt *types* without pulling prompt *text* into their bundle. |
| `text.ts` | String helpers: `join`, `lines`, `section`, `numbered`, `kv`, `when`, `selfClosingTag`. |
| `dsl.ts` | `definePrompt`, the `PromptDef`/`AnyPromptDef` types, `normalizeInput`, `buildPromptContext`. |
| `explain-schema.ts` | The zod schema and JSON Schema for `explain`'s structured output. |
| `defs/*.ts` | One module per prompt, plus `shared.ts` for the pieces they have in common. |
| `../prompt.ts` | The `PROMPTS` registry and the public surface. |

## Writing a prompt

```ts
export type MyCtx = { text: string; lang: PromptLang; page?: PageContext };

export const myPrompt = definePrompt<MyCtx>({
  id: "myPrompt",
  input: "string",
  system: (ctx) => join(
    translatorPreamble(ctx.lang.dst),
    section("instructions", numbered(
      "Always do this.",
      when(ctx.page, "Only mentioned when page context exists."),
    )),
    pageSection(ctx.page),
  ),
  user: (ctx) => ctx.text,
  parse: (raw) => raw,
});
```

Then add the id to `PromptId`, its output type to `PromptOutputMap`, and the
definition to `PROMPTS`. The registry's mapped type will not compile until all
three line up.

## Conventions worth knowing

- **Helpers drop empty parts.** `join`/`lines`/`numbered` filter out `undefined`,
  `null`, `false` and `""`, and `section`/`kv` return `undefined` when they would
  be empty. That is what lets `when(...)` be used inline without leaving blank
  lines or empty tags behind.
- **`numbered` renumbers after filtering.** A conditional list item never leaves
  a gap in the sequence, which is what the old templates got wrong by hardcoding
  ordinals inside `{{#if}}` branches.
- **`input` is checked against the context.** Declaring `input: "string"` with a
  `text: string[]` context is a compile error.
- **`parse` runs on completed responses only.** Streaming yields raw text
  chunks; callers that need structured data parse the accumulated string
  themselves (see `jsonAutocomplete`).
- **`ctx.lang` holds native names**, not language codes — `buildPromptContext`
  maps them, and leaves `lang.src` undefined when auto-detecting.
