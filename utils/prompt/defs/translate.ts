import { definePrompt } from "../dsl";
import { join, numbered, section, when } from "../text";
import { pageSection, targetSpan, translatorPreamble } from "./shared";

const BANK_EXAMPLE = `<example>
## INPUT

We had a picnic by the <target>bank</target> of the river.

## OUTPUT

岸

</example>`;

const longTextExample = (dst: string) => `<example>
## INPUT

Why does the sky appear blue?

<target>[[Very long text #1]]</target> [[Very long text #2]] ... [[Very long text #N]]

## OUTPUT

"[[Very long text #1]]" in "${dst}".
</example>`;

/** Translate a single span of text, shown with its surrounding context. */
export const translatePrompt = definePrompt<"translate">({
	id: "translate",
	input: "string",
	system: (ctx) =>
		join(
			translatorPreamble(ctx.lang),
			section(
				"instructions",
				numbered(
					`You should translate the text within the \`<target>\` tags into "${ctx.lang.dst}". Do not translate any text outside the \`<target>\`.`,
					when(
						ctx.page,
						"Context of current page is wrapped in `<page>` tags. Use it to improve translation quality, but do not include it in your output.",
					),
				),
			),
			BANK_EXAMPLE,
			longTextExample(ctx.lang.dst),
			pageSection(ctx.page),
		),
	user: (ctx) => targetSpan(ctx.text, ctx.surr),
	parse: (raw) => raw,
});
