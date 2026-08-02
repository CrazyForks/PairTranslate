import { describe, expect, test } from "bun:test";
import {
	batchTranslatePrompt,
	renderBatchInput,
	splitBatchOutput,
} from "./batch-translate";

describe("splitBatchOutput", () => {
	test("round-trips the rendered input, entry for entry", () => {
		const texts = ["first", "second", "third"];
		expect(splitBatchOutput(renderBatchInput(texts), texts.length)).toEqual(
			texts,
		);
	});

	test("round-trip preserves length for many entries", () => {
		const texts = Array.from({ length: 25 }, (_, i) => `paragraph ${i}`);
		expect(splitBatchOutput(renderBatchInput(texts), texts.length)).toEqual(
			texts,
		);
	});

	test("a leading divider produces no empty first entry", () => {
		expect(splitBatchOutput("==== 0\n\nonly", 1)).toEqual(["only"]);
	});

	test("keeps multi-line paragraphs intact", () => {
		const [entry] = splitBatchOutput(
			"==== 0\n\nline one\nline two\n\nline three",
			1,
		);
		expect(entry).toBe("line one\nline two\n\nline three");
	});

	test("does not split on a mid-line ====", () => {
		expect(splitBatchOutput("==== 0\n\nsee ==== 1 inline", 1)).toEqual([
			"see ==== 1 inline",
		]);
	});

	test("requires a digit after the divider", () => {
		expect(splitBatchOutput("==== x\n\na", 1)).toEqual([undefined]);
	});

	test("always returns one slot per input, even with no dividers", () => {
		expect(splitBatchOutput("", 3)).toEqual([undefined, undefined, undefined]);
		expect(splitBatchOutput("bare text", 2)).toEqual([undefined, undefined]);
	});
});

describe("splitBatchOutput alignment", () => {
	test("a blank middle entry leaves a hole instead of shifting later ones", () => {
		expect(
			splitBatchOutput("==== 0\n\na\n\n==== 1\n\n\n\n==== 2\n\nc", 3),
		).toEqual(["a", undefined, "c"]);
	});

	test("a skipped index leaves a hole and keeps the rest in place", () => {
		expect(splitBatchOutput("==== 0\n\na\n\n==== 2\n\nc", 3)).toEqual([
			"a",
			undefined,
			"c",
		]);
	});

	test("out-of-order dividers land on their own index", () => {
		expect(splitBatchOutput("==== 2\n\nc\n\n==== 0\n\na", 3)).toEqual([
			"a",
			undefined,
			"c",
		]);
	});

	test("indices beyond the input length are discarded, not appended", () => {
		expect(splitBatchOutput("==== 0\n\na\n\n==== 9\n\nstray", 2)).toEqual([
			"a",
			undefined,
		]);
	});

	test("trims surrounding whitespace per entry", () => {
		expect(splitBatchOutput("==== 0\n\n  a  \n\n==== 1\n\n  b  ", 2)).toEqual([
			"a",
			"b",
		]);
	});
});

describe("batchTranslatePrompt", () => {
	const LANG = { dst: "日本語" };

	test("states the exact paragraph count", () => {
		const user = batchTranslatePrompt.user({
			text: ["a", "b", "c"],
			lang: LANG,
		});
		expect(user).toContain("exactly 3 paragraphs");
	});

	test("emits one divider per input paragraph", () => {
		const user = batchTranslatePrompt.user({
			text: ["a", "b", "c"],
			lang: LANG,
		});
		expect(user.match(/^==== \d+$/gm)).toHaveLength(3);
	});

	test("declares stringArray input and parses against the input length", () => {
		expect(batchTranslatePrompt.input).toBe("stringArray");
		expect(
			batchTranslatePrompt.parse("==== 0\n\nx", { text: ["a"], lang: LANG }),
		).toEqual(["x"]);
	});

	test("parse pads to the input length when the model returns too few", () => {
		expect(
			batchTranslatePrompt.parse("==== 0\n\nx", {
				text: ["a", "b"],
				lang: LANG,
			}),
		).toEqual(["x", undefined]);
	});
});
