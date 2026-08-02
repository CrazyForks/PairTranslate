import type { PageContext } from "~/utils/types";
import type { FocusedElement, PromptLang, Surr } from "../ctx";
import { join, kv, numbered, section, selfClosingTag } from "../text";

/**
 * Shared opening for the three translation prompts: role, task, and the
 * three-perspective guidelines. Mentions the source language when known (not
 * auto-detecting), which gives the model a signal for disambiguation and for
 * "leave as-is if already in the target."
 */
export const translatorPreamble = (lang: PromptLang): string =>
	join(
		`You are a professional translator. You will be given ${lang.src ? `"${lang.src}" text to translate` : "some text to translate, with some relevant background information"}. You need to translate the text into "${lang.dst}".`,
		section(
			"guidelines",
			numbered(
				"From the perspective of the original author, consider what they want to express and accurately convey their meaning.",
				"From the translator's perspective, consider how to adjust the word order to make the text fluent and natural.",
				`From the perspective of a native speaker of "${lang.dst}", consider what vocabulary they would use to express a similar meaning.`,
			),
		),
	);

/** `<page>` block listing the page-level context, or nothing when absent. */
export const pageSection = (page?: PageContext): string | undefined =>
	section("page", kv(page));

/** Wrap the target text in `<target>` tags, keeping its surrounding text. */
export const targetSpan = (text: string, surr?: Surr): string =>
	`${surr?.before ?? ""}<target>${text}</target>${surr?.after ?? ""}`;

/** `<element_info />` with the focused field's metadata, or nothing when absent. */
export const elementSection = (element?: FocusedElement): string | undefined =>
	element
		? section("element_info", selfClosingTag(element.tag, element.attrs))
		: undefined;
