import z from "zod";
import type { JSONSchema } from "~/utils/llm";

export const ExplainOutput = z.object({
	context_explanation: z.string(),
	text_explanation: z.string(),
	examples: z
		.array(
			z.object({
				text: z.string(),
				translation: z.string(),
			}),
		)
		.optional(),
});
export type ExplainOutput = z.infer<typeof ExplainOutput>;

export const EXPLAIN_SCHEMA: JSONSchema = z.toJSONSchema(ExplainOutput);
