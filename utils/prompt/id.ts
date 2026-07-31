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

/** What each prompt's `parse` produces from a completed (non-streamed) response. */
export type PromptOutputMap = {
	translate: string;
	batchTranslate: string[];
	inputTranslate: string;
	dictionaryTranslate: string;
	explain: ExplainOutput;
};

export type PromptOutput<Id extends PromptId> = PromptOutputMap[Id];
