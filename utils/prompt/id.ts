import type { ExplainOutput } from "./explain-schema";

/**
 * Identifies a prompt. Prompts are static, so this doubles as the RPC wire
 * value and the registry key.
 *
 * This module is deliberately a leaf: consumers that only need prompt *types*
 * (content scripts, `hooks/translation.ts`) import from here and never pull
 * prompt *text* into their bundles.
 */
export type PromptId =
	| "translate"
	| "batchTranslate"
	| "inputTranslate"
	| "dictionaryTranslate"
	| "explain";

/**
 * Bumped by hand whenever prompt *text* changes in a way that should invalidate
 * cached model output. It is part of the cache key, so old entries are ignored
 * rather than served against a prompt that no longer produced them.
 */
export const PROMPT_REVISION = 2;

/** What each prompt's `parse` produces from a completed (non-streamed) response. */
export type PromptOutputMap = {
	translate: string;
	/**
	 * Sparse by design: one slot per input paragraph, `undefined` where the model
	 * dropped or blanked an entry. Indexed off the `==== <index>` divider, so a
	 * missing entry leaves a hole instead of shifting every later translation.
	 */
	batchTranslate: (string | undefined)[];
	inputTranslate: string;
	dictionaryTranslate: string;
	explain: ExplainOutput;
};

export type PromptOutput<Id extends PromptId> = PromptOutputMap[Id];
