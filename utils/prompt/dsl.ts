/** biome-ignore-all lint/suspicious/noExplicitAny: erased ctx at the runtime boundary */

import { getNativeName } from "~/utils/constants";
import type { JSONSchema } from "~/utils/llm";
import type { PromptId } from "./id";

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

export type PromptInputKind = "string" | "stringArray";

/**
 * A prompt definition. `system` and `user` are pure functions of a typed
 * context; `parse` turns a completed response body into the prompt's output.
 */
export type PromptDef<Ctx extends PromptCtxBase, Out> = {
	id: PromptId;
	/** Derived from `Ctx["text"]` — a mismatch is a compile error. */
	input: Ctx["text"] extends string[] ? "stringArray" : "string";
	system: (ctx: Ctx) => string;
	user: (ctx: Ctx) => string;
	parse: (raw: string) => Out;
	/** Present only for prompts that want provider structured-output mode. */
	schema?: JSONSchema;
};

/**
 * Context-erased view of a definition, for consumers that build the context
 * dynamically from an RPC payload. This is the one place the typed context
 * contract is given up, so it stays contained here.
 */
export type AnyPromptDef<Out = unknown> = Omit<
	PromptDef<PromptCtxBase, Out>,
	"system" | "user" | "input"
> & {
	input: PromptInputKind;
	system: (ctx: any) => string;
	user: (ctx: any) => string;
};

export const definePrompt = <Ctx extends PromptCtxBase, Out = string>(
	def: PromptDef<Ctx, Out>,
): PromptDef<Ctx, Out> => def;

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
