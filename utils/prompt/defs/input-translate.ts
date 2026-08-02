import { definePrompt } from "../dsl";
import { bullets, join, lines, section, when } from "../text";
import { elementSection, pageSection, translatorPreamble } from "./shared";

const inputExample = (dst: string) => `<example>
## INPUT

Hello Sam,
I hope this email finds you well. ...

## OUTPUT (in ${dst})

[Translation in ${dst}]
</example>`;

/** Translate what the user typed into a focused input, describing that input. */
export const inputTranslatePrompt = definePrompt<"inputTranslate">({
	id: "inputTranslate",
	input: "string",
	system: (ctx) =>
		join(
			translatorPreamble(ctx.lang),
			section(
				"instructions",
				join(
					lines(
						"You can use the following information to improve your translations:",
						bullets(
							when(
								ctx.page,
								"Context of current page is wrapped in <page> tags.",
							),
							when(
								ctx.element,
								"Context of current focused element is wrapped in <element_info> tags.",
							),
						),
					),
					"Output the translated text **ONLY**, without any additional explanations or notes.",
				),
			),
			inputExample(ctx.lang.dst),
			pageSection(ctx.page),
			elementSection(ctx.element),
		),
	user: (ctx) => ctx.text,
	parse: (raw) => raw,
});
