/** biome-ignore-all lint/suspicious/noExplicitAny: erased ctx at the runtime boundary */

import { getNativeName } from "~/utils/constants";
import type { JSONSchema } from "~/utils/llm";
import type { PromptCtxBase, PromptCtxMap } from "~/utils/prompt/ctx";
import type { PromptId, PromptOutputMap } from "./id";

export type PromptInputKind = "string" | "stringArray";

/**
 * A prompt definition. `system` and `user` are pure functions of a typed
 * context; `parse` turns a completed response body *and* the prompt context
 * that produced it into the prompt's output.
 */
export type PromptDef<Id extends PromptId, Ctx extends PromptCtxBase> = {
	id: Id;
	/** Derived from `Ctx["text"]` — a mismatch is a compile error. */
	input: Ctx["text"] extends string[] ? "stringArray" : "string";
	system: (ctx: Ctx) => string;
	user: (ctx: Ctx) => string;
	parse: (raw: string, ctx: Ctx) => PromptOutputMap[Id];
	/** Present only for prompts that want provider structured-output mode. */
	schema?: JSONSchema;
};

/**
 * Context-erased view of a definition, for consumers that build the context
 * dynamically from an RPC payload. This is the one place the typed context
 * contract is given up, so it stays contained here.
 */
export type AnyPromptDef<Out = unknown> = Omit<
	PromptDef<PromptId, PromptCtxBase>,
	"system" | "user" | "parse" | "input"
> & {
	input: PromptInputKind;
	system: (ctx: any) => string;
	user: (ctx: any) => string;
	parse: (raw: string, ctx: any) => Out;
};

export const definePrompt = <
	Id extends PromptId,
	Ctx extends PromptCtxMap[Id] = PromptCtxMap[Id],
>(
	def: PromptDef<Id, Ctx>,
): PromptDef<Id, Ctx> => def;

/** Coerce a payload to the shape the prompt declares it accepts. */
export const normalizeInput = (
	kind: PromptInputKind,
	text: string | string[] | undefined,
): string | string[] => {
	if (kind === "stringArray") {
		if (Array.isArray(text)) return text;
		return text ? [text] : [];
	}
	return Array.isArray(text) ? text.join("\n\n") : (text ?? "");
};

/**
 * Assemble a prompt context from the caller-supplied extras plus the resolved
 * input and language pair. Language codes are mapped to native names, matching
 * what prompts show the model.
 */
export const buildPromptContext = <Extra extends object>(
	extra: Extra,
	text: string | string[],
	srcLang: string | undefined,
	dstLang: string,
): Extra & PromptCtxBase => ({
	...extra,
	text,
	lang: {
		src: srcLang && srcLang !== "auto" ? getNativeName(srcLang) : undefined,
		dst: getNativeName(dstLang),
	},
});
