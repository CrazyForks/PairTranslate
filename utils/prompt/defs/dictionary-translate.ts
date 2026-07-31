import { definePrompt, type PromptLang } from "../dsl";
import { join, lines, section } from "../text";

export type DictionaryTranslateCtx = {
	text: string;
	lang: PromptLang;
	/** The headword the definition belongs to. */
	word?: string;
};

/** Translate a dictionary definition, keeping synonyms and examples readable. */
export const dictionaryTranslatePrompt = definePrompt<DictionaryTranslateCtx>({
	id: "dictionaryTranslate",
	input: "string",
	system: (ctx) =>
		join(
			"You will be given a dictionary definition for a word or phrase.",
			section(
				"task",
				`translate this definition into ${ctx.lang.dst}, ensuring that the meaning is preserved accurately. Use clear and concise language suitable for a general audience.`,
			),
			section(
				"note",
				lines(
					'+ For "synonyms" and "antonyms", preserve them in their original language, formatting each word by enclosing it in backticks (`).',
					`+ For examples, first output the original example in backticks, followed by its translation in ${ctx.lang.dst}.`,
				),
			),
		),
	user: (ctx) => ctx.text,
	parse: (raw) => raw,
});
