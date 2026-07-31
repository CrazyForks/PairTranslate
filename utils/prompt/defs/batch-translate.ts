import type { PageContext } from "~/utils/types";
import { definePrompt, type PromptLang } from "../dsl";
import { join, numbered, section, when } from "../text";
import { pageSection, translatorPreamble } from "./shared";

export type BatchTranslateCtx = {
	text: string[];
	lang: PromptLang;
	page?: PageContext;
};

/**
 * The `==== <index>` divider the model is told to preserve. Anchored to line
 * starts so a literal `====` inside a paragraph is not a split point.
 *
 * No `g` flag: `String.prototype.split` ignores it, and omitting it avoids any
 * `lastIndex` surprises if the regex is reused.
 */
const BATCH_DELIMITER = /^==== \d+/m;

/** Split a batch response back into one entry per input paragraph. */
export const splitBatchOutput = (raw: string): string[] =>
	raw
		.split(BATCH_DELIMITER)
		.map((entry) => entry.trim())
		.filter(Boolean);

/** Render the input paragraphs with the dividers the model must echo back. */
export const renderBatchInput = (texts: string[]): string =>
	texts.map((text, index) => `==== ${index}\n\n${text}`).join("\n\n");

const BATCH_EXAMPLE = `<example>
## Input
==== 0

To prove that $1 + 1 = 2$, we start with the definition of addition:

==== 1

Let $a$ and $b$ be two numbers. The sum $a + b$ is defined as the **total** quantity obtained by combining $a$ and $b$ ...

## Output
==== 0

为了证明 $1 + 1 = 2$，我们从加法的定义开始：

==== 1

令 $a$ 和 $b$ 为两个数。和 $a + b$ 定义为将 $a$ 和 $b$ 结合后得到的**总**数量...

</example>`;

/** Translate many paragraphs in one call, delimited so they can be split apart. */
export const batchTranslatePrompt = definePrompt<BatchTranslateCtx, string[]>({
	id: "batchTranslate",
	input: "stringArray",
	system: (ctx) =>
		join(
			translatorPreamble(ctx.lang.dst),
			section(
				"format",
				numbered(
					"Markdown format is supported. Preserve the original markdown notations as-is.",
					"You should output the translations of all paragraphs while preserving the original `==== <index>` dividers.",
					when(
						ctx.page,
						"Context of current page is wrapped in <page> tags, and all given paragraphs share the same context. Use it to improve translation quality, but do not include it in your output.",
					),
				),
			),
			BATCH_EXAMPLE,
			pageSection(ctx.page),
		),
	user: (ctx) =>
		join(
			section(
				"instructions",
				`You must output exactly ${ctx.text.length} paragraphs divided by \`==== <index>\`, directly output your translations without any explanation or context information`,
			),
			renderBatchInput(ctx.text),
		),
	parse: splitBatchOutput,
});
