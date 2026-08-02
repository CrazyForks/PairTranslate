# Prompts

Prompts are static TypeScript, not user configuration. Each one is a pure
function of a typed context to a string, so prompt text is type-checked and
unit-testable, and there is no template language to parse at runtime.

## Layout

| Path | Role |
| --- | --- |
| `id.ts` | `PromptId` union, `PromptOutputMap`, `PROMPT_REVISION`. A leaf module, so consumers can import prompt *types* without pulling prompt *text* into their bundle. |
| `ctx.ts` | Every prompt's context type, plus `PromptCtxMap` keyed by id. Also a leaf, for the same reason — this is what lets callers be type-checked against the prompt they name. |
| `text.ts` | String helpers: `join`, `lines`, `section`, `numbered`, `bullets`, `kv`, `when`, `selfClosingTag`, `untrusted`. |
| `dsl.ts` | `definePrompt`, the `PromptDef`/`AnyPromptDef` types, `normalizeInput`, `buildPromptContext`. |
| `explain-schema.ts` | The zod schema and JSON Schema for `explain`'s structured output. |
| `defs/*.ts` | One module per prompt, plus `shared.ts` for the pieces they have in common. |
| `../prompt.ts` | The `PROMPTS` registry and the public surface. |

## Writing a prompt

Add the id to `PromptId`, its output type to `PromptOutputMap`, and its context
type to `PromptCtxMap` (in `ctx.ts`). Then the definition takes only the id as a
type argument — context and output are both looked up from those maps:

```ts
// ctx.ts
export type MyCtx = { text: string; lang: PromptLang; page?: PageContext };
export type PromptCtxMap = { /* … */ myPrompt: MyCtx };

// defs/my-prompt.ts
export const myPrompt = definePrompt<"myPrompt">({
  id: "myPrompt",
  input: "string",
  system: (ctx) => join(
    translatorPreamble(ctx.lang),
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

Finally add it to `PROMPTS`. The registry's mapped type will not compile until
the id, context and output all line up.

## Conventions worth knowing

- **Helpers drop empty parts.** `join`/`lines`/`numbered`/`bullets` filter out
  `undefined`, `null`, `false` and `""`, and `section`/`kv`/`selfClosingTag`
  return `undefined` when they would be empty. That is what lets `when(...)` be
  used inline without leaving blank lines or empty tags behind.
- **`numbered` renumbers after filtering.** A conditional list item never leaves
  a gap in the sequence, which is what the old templates got wrong by hardcoding
  ordinals inside `{{#if}}` branches.
- **A nested array is one list item.** `Part` is recursive, so
  `numbered("a", ["b", "  - sub"])` gives `b` a single marker with `- sub` as its
  continuation line. Use it for indented sub-lists instead of hand-joining.
- **Page-derived values are escaped.** Anything from the page — `page` metadata,
  element attributes — passes through `untrusted`, which strips `<>"'`,
  collapses whitespace and caps length. Without it a hostile page could close
  the surrounding tag and append its own instructions to the *system* message.
  Use it for any new context field that comes from the DOM.
- **`input` is checked against the context.** Declaring `input: "string"` with a
  `text: string[]` context is a compile error.
- **`parse` receives the context** that produced the request, so it can validate
  against it — `batchTranslate` uses `ctx.text.length` to return one slot per
  input paragraph. It runs on completed responses only: streaming yields raw
  text chunks, and callers that need structured data parse the accumulated
  string themselves (see `jsonAutocomplete`).
- **`batchTranslate` output is sparse.** Entries are placed by the index in their
  `==== <index>` divider, not by position, so a dropped paragraph leaves a hole
  instead of shifting every later translation onto the wrong original.
- **`ctx.lang` holds native names**, not language codes — `buildPromptContext`
  maps them, and leaves `lang.src` undefined when auto-detecting. Prompts should
  read `lang.src` only through `when`/a conditional, since it is often absent.
- **Few-shot examples must not hardcode a target language.** Take `dst` and use
  a placeholder for the output (`[Translation in ${dst}]`); a concrete example in
  the wrong language pulls the model's output toward it.
- **Bump `PROMPT_REVISION` when prompt text changes** in a way that should
  invalidate cached output. It is part of the cache key.
