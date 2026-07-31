import { describe, expect, test } from "bun:test";
import {
	batchTranslatePrompt,
	renderBatchInput,
	splitBatchOutput,
} from "./batch-translate";

describe("splitBatchOutput", () => {
	test("round-trips the rendered input, entry for entry", () => {
		const texts = ["first", "second", "third"];
		expect(splitBatchOutput(renderBatchInput(texts))).toEqual(texts);
	});

	test("round-trip preserves length for many entries", () => {
		const texts = Array.from({ length: 25 }, (_, i) => `paragraph ${i}`);
		expect(splitBatchOutput(renderBatchInput(texts))).toHaveLength(
			texts.length,
		);
	});

	test("a leading divider produces no empty first entry", () => {
		expect(splitBatchOutput("==== 0\n\nonly")).toEqual(["only"]);
	});

	test("trims entries and drops blank ones", () => {
		expect(
			splitBatchOutput("==== 0\n\n  a  \n\n==== 1\n\n\n\n==== 2\n\nb"),
		).toEqual(["a", "b"]);
	});

	test("keeps multi-line paragraphs intact", () => {
		const [entry] = splitBatchOutput(
			"==== 0\n\nline one\nline two\n\nline three",
		);
		expect(entry).toBe("line one\nline two\n\nline three");
	});

	test("does not split on a mid-line ====", () => {
		expect(splitBatchOutput("==== 0\n\nsee ==== 1 inline")).toEqual([
			"see ==== 1 inline",
		]);
	});

	test("splits on any index, not just the expected sequence", () => {
		expect(splitBatchOutput("==== 7\n\na\n\n==== 42\n\nb")).toEqual(["a", "b"]);
	});

	test("requires a digit after the divider", () => {
		expect(splitBatchOutput("==== x\n\na")).toEqual(["==== x\n\na"]);
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

	test("declares stringArray input and parses to an array", () => {
		expect(batchTranslatePrompt.input).toBe("stringArray");
		expect(batchTranslatePrompt.parse("==== 0\n\nx")).toEqual(["x"]);
	});
});
