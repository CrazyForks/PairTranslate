import type { PageContext } from "~/utils/types";
import { definePrompt, type PromptLang } from "../dsl";
import { join, lines, section, selfClosingTag, when } from "../text";
import { pageSection, translatorPreamble } from "./shared";

/** The form field the user is typing into. */
export type FocusedElement = {
	tag: string;
	attrs?: Record<string, string>;
};

export type InputTranslateCtx = {
	text: string;
	lang: PromptLang;
	page?: PageContext;
	element?: FocusedElement;
};

const EXAMPLE = `<example>
## INPUT

Hello Sam,
I hope this email finds you well. ...

## OUTPUT

サムさんへ

ご無沙汰しております。...
</example>`;

const elementSection = (element?: FocusedElement) =>
	element
		? section("element_info", selfClosingTag(element.tag, element.attrs))
		: undefined;

/** Translate what the user typed into a focused input, describing that input. */
export const inputTranslatePrompt = definePrompt<InputTranslateCtx>({
	id: "inputTranslate",
	input: "string",
	system: (ctx) =>
		join(
			translatorPreamble(ctx.lang.dst),
			section(
				"instructions",
				join(
					lines(
						"You can use the following information to improve your translations:",
						when(
							ctx.page,
							"+ Context of current page is wrapped in <page> tags.",
						),
						when(
							ctx.element,
							"+ Context of current focused element is wrapped in <element_info> tags.",
						),
					),
					"Output the translated text **ONLY**, without any additional explanations or notes.",
				),
			),
			EXAMPLE,
			pageSection(ctx.page),
			elementSection(ctx.element),
		),
	user: (ctx) => ctx.text,
	parse: (raw) => raw,
});
