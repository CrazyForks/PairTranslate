import { describe, expect, test } from "bun:test";
import { EXPLAIN_SCHEMA } from "../explain-schema";
import { explainPrompt } from "./explain";

const VALID = {
	context_explanation: "in context",
	text_explanation: "the text",
	examples: [{ text: "an example", translation: "訳" }],
};

describe("EXPLAIN_SCHEMA", () => {
	test("describes the three output properties", () => {
		const properties = (EXPLAIN_SCHEMA as { properties: object }).properties;
		expect(Object.keys(properties)).toEqual([
			"context_explanation",
			"text_explanation",
			"examples",
		]);
	});

	test("requires the two explanation fields", () => {
		expect((EXPLAIN_SCHEMA as { required: string[] }).required).toEqual([
			"context_explanation",
			"text_explanation",
		]);
	});
});

describe("explainPrompt.parse", () => {
	test("accepts bare JSON", () => {
		expect(explainPrompt.parse(JSON.stringify(VALID))).toEqual(VALID);
	});

	test("accepts JSON inside a fenced code block", () => {
		const fenced = `\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\``;
		expect(explainPrompt.parse(fenced)).toEqual(VALID);
	});

	test("treats examples as optional", () => {
		const { examples: _omitted, ...withoutExamples } = VALID;
		expect(explainPrompt.parse(JSON.stringify(withoutExamples))).toEqual(
			withoutExamples,
		);
	});

	test("throws on malformed JSON", () => {
		expect(() => explainPrompt.parse("not json at all")).toThrow();
	});

	test("throws when a required field is missing", () => {
		expect(() =>
			explainPrompt.parse(JSON.stringify({ text_explanation: "only one" })),
		).toThrow();
	});
});

describe("explainPrompt", () => {
	test("carries the schema so structured-output mode can be requested", () => {
		expect(explainPrompt.schema).toBe(EXPLAIN_SCHEMA);
	});
});
