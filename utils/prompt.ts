import { batchTranslatePrompt } from "./prompt/defs/batch-translate";
import { dictionaryTranslatePrompt } from "./prompt/defs/dictionary-translate";
import { explainPrompt } from "./prompt/defs/explain";
import { inputTranslatePrompt } from "./prompt/defs/input-translate";
import { translatePrompt } from "./prompt/defs/translate";
import type { AnyPromptDef } from "./prompt/dsl";
import type { PromptId, PromptOutputMap } from "./prompt/id";

type PromptRegistry = {
	[Id in PromptId]: AnyPromptDef<PromptOutputMap[Id]>;
};

/**
 * Every prompt the extension can run. Static by design — prompts are code, not
 * configuration. The mapped type enforces that each id is covered and that each
 * definition's `parse` returns the output type declared in `PromptOutputMap`.
 */
export const PROMPTS: PromptRegistry = {
	translate: translatePrompt,
	batchTranslate: batchTranslatePrompt,
	inputTranslate: inputTranslatePrompt,
	dictionaryTranslate: dictionaryTranslatePrompt,
	explain: explainPrompt,
};

export type { ExplainOutput } from "./prompt/explain-schema";
export { EXPLAIN_SCHEMA } from "./prompt/explain-schema";
export type { PromptId, PromptOutput } from "./prompt/id";
