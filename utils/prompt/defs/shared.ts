import type { PageContext } from "~/utils/types";
import { join, kv, numbered, section } from "../text";

/** Text immediately surrounding the target, used to give the model context. */
export type Surr = {
	before?: string;
	after?: string;
};

/**
 * Shared opening for the three translation prompts: role, task, and the
 * three-perspective guidelines.
 */
export const translatorPreamble = (dst: string): string =>
	join(
		`You are a professional translator. You will be given some text to translate, with some relevant background information. You need to translate the text into "${dst}".`,
		section(
			"guidelines",
			numbered(
				"From the perspective of the original author, consider what they want to express and accurately convey their meaning.",
				"From the translator's perspective, consider how to adjust the word order to make the text fluent and natural.",
				`From the perspective of a native speaker of "${dst}", consider what vocabulary they would use to express a similar meaning.`,
			),
		),
	);

/** `<page>` block listing the page-level context, or nothing when absent. */
export const pageSection = (page?: PageContext): string | undefined =>
	section("page", kv(page));

/** Wrap the target text in `<target>` tags, keeping its surrounding text. */
export const targetSpan = (text: string, surr?: Surr): string =>
	`${surr?.before ?? ""}<target>${text}</target>${surr?.after ?? ""}`;
