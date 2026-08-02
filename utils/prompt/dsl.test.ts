import { describe, expect, test } from "bun:test";
import { buildPromptContext, normalizeInput } from "./dsl";

describe("normalizeInput", () => {
	test("stringArray wraps a lone string", () => {
		expect(normalizeInput("stringArray", "x")).toEqual(["x"]);
	});

	test("stringArray passes arrays through", () => {
		expect(normalizeInput("stringArray", ["a", "b"])).toEqual(["a", "b"]);
	});

	test("stringArray yields an empty array for empty input", () => {
		expect(normalizeInput("stringArray", "")).toEqual([]);
		expect(normalizeInput("stringArray", undefined)).toEqual([]);
	});

	test("string joins an array with a blank line", () => {
		expect(normalizeInput("string", ["a", "b"])).toBe("a\n\nb");
	});

	test("string passes strings through and defaults to empty", () => {
		expect(normalizeInput("string", "a")).toBe("a");
		expect(normalizeInput("string", undefined)).toBe("");
	});
});

describe("buildPromptContext", () => {
	test("maps language codes to native names", () => {
		const ctx = buildPromptContext({}, "hello", "en", "ja");
		expect(ctx.lang.src).toBe("English");
		expect(ctx.lang.dst).toBe("日本語");
	});

	test("leaves src undefined when auto-detecting", () => {
		expect(
			buildPromptContext({}, "hello", "auto", "ja").lang.src,
		).toBeUndefined();
		expect(
			buildPromptContext({}, "hello", undefined, "ja").lang.src,
		).toBeUndefined();
	});

	test("passes unknown codes through unchanged", () => {
		expect(buildPromptContext({}, "hello", undefined, "xx-YY").lang.dst).toBe(
			"xx-YY",
		);
	});

	test("extras cannot override the resolved text and language", () => {
		const ctx = buildPromptContext(
			{ text: "stale", lang: { dst: "stale" } } as unknown as object,
			"fresh",
			"en",
			"ja",
		);
		expect(ctx.text).toBe("fresh");
		expect(ctx.lang).toEqual({ src: "English", dst: "日本語" });
	});

	test("carries the text and extra context keys", () => {
		const ctx = buildPromptContext(
			{ page: { title: "T", domain: "d" }, word: "bank" },
			["a", "b"],
			"auto",
			"en",
		);
		expect(ctx.text).toEqual(["a", "b"]);
		expect(ctx.page).toEqual({ title: "T", domain: "d" });
		expect(ctx.word).toBe("bank");
	});
});
