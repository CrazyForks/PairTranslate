import { PROMPT_REVISION } from "./prompt/id";
import type { TranslateContext } from "./types";

const encoder = new TextEncoder();
export const computeCacheKey = async (
	promptId: string,
	modelId: string,
	text: string | string[] = "",
	ctx: TranslateContext,
	srcLang?: string,
	dstLang?: string,
) => {
	const D = "\u200C"; // Zero-width non-joiner to separate fields
	// `PROMPT_REVISION` is part of the key so that editing prompt text in a
	// release stops us serving output the old prompt produced.
	let str = `r${PROMPT_REVISION}${D}${promptId}${D}${modelId}${D}${Array.isArray(text) ? text.join(D) : text}${D}`;
	if (ctx.surr) {
		if (ctx.surr.before) str += `${ctx.surr.before}${D}`;
		if (ctx.surr.after) str += `${ctx.surr.after}${D}`;
	}

	if (ctx.page) {
		// For hit rate, we only hash the domain of the page context
		str += ctx.page.domain;
	}

	// `element` and `word` change the prompt, so they have to change the key \u2014
	// otherwise the same text on the same domain collides across different form
	// fields or dictionary headwords.
	const element = ctx.element as
		| { tag?: string; attrs?: Record<string, string> }
		| undefined;
	if (element) {
		str += `${D}el:${element.tag ?? ""}`;
		if (element.attrs) {
			for (const [key, value] of Object.entries(element.attrs).sort(
				([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
			)) {
				str += `${D}${key}=${value}`;
			}
		}
	}
	if (typeof ctx.word === "string" && ctx.word) {
		str += `${D}word:${ctx.word}`;
	}

	if (srcLang) str += `${D}src:${srcLang}`;
	if (dstLang) str += `${D}dst:${dstLang}`;

	const buf = await crypto.subtle.digest("SHA-256", encoder.encode(str));
	return buf;
};
