import { definePrompt } from "../dsl";
import { join, numbered, section, when } from "../text";
import { pageSection, translatorPreamble } from "./shared";

/**
 * The `==== <index>` divider the model is told to echo back, capturing the
 * index. Anchored to line starts so a literal `====` inside a paragraph is not
 * a split point.
 */
const BATCH_DELIMITER = /^==== (\d+)/gm;

/**
 * Split a batch response into one entry per input paragraph, placed by the index
 * carried in its `==== <index>` divider rather than by position.
 *
 * The result is always `inputLength` long, with `undefined` wherever the model
 * dropped, blanked, or skipped an entry. Positional reassembly was the bug this
 * replaces: one missing paragraph used to shift every later translation onto the
 * wrong original, which is silently wrong rather than visibly broken.
 */
export const splitBatchOutput = (
	raw: string,
	inputLength: number,
): (string | undefined)[] => {
	const result: (string | undefined)[] = Array.from({ length: inputLength });
	// Each divider's content runs to the start of the next divider, so entries
	// are written one iteration behind the match that terminates them.
	let pending: { index: number; from: number } | null = null;

	const write = (entry: { index: number; from: number }, to?: number) => {
		const content = raw.slice(entry.from, to).trim();
		if (content && entry.index < inputLength) {
			result[entry.index] = content;
		}
	};

	for (const match of raw.matchAll(BATCH_DELIMITER)) {
		if (pending) write(pending, match.index);
		pending = {
			index: Number.parseInt(match[1], 10),
			from: match.index + match[0].length,
		};
	}
	if (pending) write(pending);

	return result;
};

/** Render the input paragraphs with the dividers the model must echo back. */
export const renderBatchInput = (texts: string[]): string =>
	texts.map((text, index) => `==== ${index}\n\n${text}`).join("\n\n");

const batchExample = (dst: string) => `<example>
## Input
==== 0

To prove that $1 + 1 = 2$, we start with the definition of addition:

==== 1

Let $a$ and $b$ be two numbers. The sum $a + b$ is defined as the **total** quantity obtained by combining $a$ and $b$ ...

## Output (in ${dst})
==== 0

[Translation of paragraph 0 in ${dst}]

==== 1

[Translation of paragraph 1 in ${dst}]

</example>`;

/** Translate many paragraphs in one call, delimited so they can be split apart. */
export const batchTranslatePrompt = definePrompt<"batchTranslate">({
	id: "batchTranslate",
	input: "stringArray",
	system: (ctx) =>
		join(
			translatorPreamble(ctx.lang),
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
			batchExample(ctx.lang.dst),
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
	parse: (raw, ctx) => splitBatchOutput(raw, ctx.text.length),
});
