import { autoStripMarkdown } from "~/utils/json-autocomplete";
import type { PageContext } from "~/utils/types";
import { definePrompt, type PromptLang } from "../dsl";
import { EXPLAIN_SCHEMA, ExplainOutput } from "../explain-schema";
import { join, numbered, section, when } from "../text";
import { pageSection, type Surr, targetSpan } from "./shared";

export type ExplainCtx = {
	text: string;
	lang: PromptLang;
	page?: PageContext;
	surr?: Surr;
};

const EXAMPLE = `<example>
## INPUT

The concept of <target>superposition</target> is fundamental in quantum mechanics. It refers to ...

## OUTPUT

{
    "context_explanation": "In the context of quantum mechanics, \`superposition\` ...",
    "text_explanation": "\`Superposition\` is a fundamental concept in quantum ...",
    "examples": [
        {
            "text": "**Superposition** in quantum mechanics allows ...",
            "translation": "**量子力学における**重ね合わせは..."
        },
        ... more examples ...
    ]
}
</example>`;

const formatSection = (dst: string) =>
	section(
		"format",
		numbered(
			"`context_explanation`: Explain the meaning of <target> word/phase in the given context, including any relevant background information or definitions.",
			"`text_explanation`: Provide a detailed explanation of the text itself, including any important concepts, ideas, or arguments presented.",
			[
				"`examples`: Provide 2-3 examples to illustrate the meaning of the <target> word/phase in similar contexts. Each example should include:",
				"   - `text`: An example sentence or phrase using the <target> word/phase.",
				`   - \`translation\`: The translation of the example into "${dst}".`,
			].join("\n"),
			"Markdown format is supported in your explanation. Use it to enhance clarity and presentation.",
		),
	);

/** Explain a term in context, returning structured JSON. */
export const explainPrompt = definePrompt<ExplainCtx, ExplainOutput>({
	id: "explain",
	input: "string",
	schema: EXPLAIN_SCHEMA,
	system: (ctx) =>
		join(
			`You are a professional translator. You will be given some background information and text to explain. Your task is to incorporate the background information and give a clear and concise explanation in "${ctx.lang.dst}".`,
			formatSection(ctx.lang.dst),
			section(
				"instructions",
				numbered(
					"Every input will contain a <target> tag indicating the specific word/phase to be explained. Make sure to focus your explanation on this target.",
					when(
						ctx.page,
						"The context of current page is wrapped in <page> tags. You can use it to extract relevant information and provide a more comprehensive explanation.",
					),
				),
			),
			EXAMPLE,
			pageSection(ctx.page),
		),
	user: (ctx) => targetSpan(ctx.text, ctx.surr),
	// `autoStripMarkdown` tolerates a fenced code block around the JSON, which
	// is what the provider clients used to do before parsing moved here.
	parse: (raw) => ExplainOutput.parse(autoStripMarkdown<unknown>(raw)),
});
