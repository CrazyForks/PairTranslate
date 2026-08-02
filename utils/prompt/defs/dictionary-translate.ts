import { definePrompt } from "../dsl";
import { bullets, join, section, when } from "../text";

/** Translate a dictionary definition, keeping synonyms and examples readable. */
export const dictionaryTranslatePrompt = definePrompt<"dictionaryTranslate">({
	id: "dictionaryTranslate",
	input: "string",
	system: (ctx) =>
		join(
			when(
				ctx.word,
				`You will be given the dictionary definition for "${ctx.word}".`,
			) || "You will be given a dictionary definition for a word or phrase.",
			section(
				"task",
				`translate this definition into ${ctx.lang.dst}, ensuring that the meaning is preserved accurately. Use clear and concise language suitable for a general audience.`,
			),
			section(
				"note",
				bullets(
					'For "synonyms" and "antonyms", preserve them in their original language, formatting each word by enclosing it in backticks (`).',
					`For examples, first output the original example in backticks, followed by its translation in ${ctx.lang.dst}.`,
				),
			),
		),
	user: (ctx) => ctx.text,
	parse: (raw) => raw,
});
