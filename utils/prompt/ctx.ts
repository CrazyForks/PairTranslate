import type { PageContext } from "~/utils/types";

/**
 * Prompt context *types* only — no prompt text, no helpers, no runtime values
 * beyond types. Like `id.ts`, this is a deliberate leaf: `hooks/translation.ts`
 * and content scripts import from here to type-check the `ctx` they pass, and
 * never pull prompt strings into their bundles.
 */

export type PromptLang = {
	/** Native name of the source language; undefined when auto-detecting. */
	src?: string;
	/** Native name of the target language. */
	dst: string;
};

/** Every prompt context carries at least the input text and the language pair. */
export type PromptCtxBase = {
	text: string | string[];
	lang: PromptLang;
};

/** Text immediately surrounding the target, used to give the model context. */
export type Surr = {
	before?: string;
	after?: string;
};

/** The form field the user is typing into. */
export type FocusedElement = {
	tag: string;
	attrs?: Record<string, string>;
};

export type TranslateCtx = {
	text: string;
	lang: PromptLang;
	page?: PageContext;
	surr?: Surr;
};

export type BatchTranslateCtx = {
	text: string[];
	lang: PromptLang;
	page?: PageContext;
};

export type InputTranslateCtx = {
	text: string;
	lang: PromptLang;
	page?: PageContext;
	element?: FocusedElement;
};

export type DictionaryTranslateCtx = {
	text: string;
	lang: PromptLang;
	/** The headword the definition belongs to. */
	word?: string;
};

export type ExplainCtx = {
	text: string;
	lang: PromptLang;
	page?: PageContext;
	surr?: Surr;
};

/**
 * The context each prompt id requires. Keyed by id so callers can be
 * type-checked against the prompt they name — see `PromptCtxExtra`.
 */
export type PromptCtxMap = {
	translate: TranslateCtx;
	batchTranslate: BatchTranslateCtx;
	inputTranslate: InputTranslateCtx;
	dictionaryTranslate: DictionaryTranslateCtx;
	explain: ExplainCtx;
};

/**
 * What a caller actually supplies: the context minus the parts the background
 * service fills in from the RPC payload (`text`) and the options (`lang`).
 */
export type PromptCtxExtra<Id extends keyof PromptCtxMap> = Omit<
	PromptCtxMap[Id],
	"text" | "lang"
>;
