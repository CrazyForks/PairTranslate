import { describe, expect, test } from "bun:test";
import { PROMPTS } from "~/utils/prompt";
import type { PromptId } from "./id";

const IDS: PromptId[] = [
	"translate",
	"batchTranslate",
	"inputTranslate",
	"dictionaryTranslate",
	"explain",
];

const LANG = { src: "English", dst: "日本語" };
const PAGE = { title: "Product announcement", domain: "example.com" };
const SURR = { before: "Seen immediately. ", after: " No CTA translation." };

/** Minimal context per prompt: only what the prompt strictly requires. */
const minimalCtx = (id: PromptId) => ({
	text: id === "batchTranslate" ? ["first", "second"] : "sample text",
	lang: LANG,
});

/** Full context per prompt: every optional key the prompt can use. */
const fullCtx = (id: PromptId) => ({
	...minimalCtx(id),
	page: PAGE,
	...(id === "translate" || id === "explain" ? { surr: SURR } : {}),
	...(id === "inputTranslate"
		? { element: { tag: "textarea", attrs: { name: "body", rows: "8" } } }
		: {}),
	...(id === "dictionaryTranslate" ? { word: "bank" } : {}),
});

describe("registry", () => {
	test("covers every id, keyed consistently", () => {
		expect(Object.keys(PROMPTS).sort()).toEqual([...IDS].sort());
		for (const id of IDS) {
			expect(PROMPTS[id].id).toBe(id);
		}
	});

	test("declares the expected input kind", () => {
		for (const id of IDS) {
			expect(PROMPTS[id].input).toBe(
				id === "batchTranslate" ? "stringArray" : "string",
			);
		}
	});

	test("renders non-empty system and user text for a minimal context", () => {
		for (const id of IDS) {
			const ctx = minimalCtx(id);
			expect(PROMPTS[id].system(ctx).length).toBeGreaterThan(0);
			expect(PROMPTS[id].user(ctx).length).toBeGreaterThan(0);
		}
	});

	test("only explain requests structured output", () => {
		for (const id of IDS) {
			if (id === "explain") expect(PROMPTS[id].schema).toBeDefined();
			else expect(PROMPTS[id].schema).toBeUndefined();
		}
	});
});

describe("conditional sections", () => {
	test("<page> appears only when page context is supplied", () => {
		for (const id of IDS) {
			const withPage = PROMPTS[id].system(fullCtx(id));
			const withoutPage = PROMPTS[id].system(minimalCtx(id));
			// dictionaryTranslate never renders page context at all.
			if (id === "dictionaryTranslate") {
				expect(withPage).not.toContain("<page>");
			} else {
				expect(withPage).toContain("<page>");
				expect(withPage).toContain("domain: example.com");
			}
			expect(withoutPage).not.toContain("<page>");
		}
	});

	test("<element_info> appears only for inputTranslate with an element", () => {
		expect(PROMPTS.inputTranslate.system(fullCtx("inputTranslate"))).toContain(
			'<textarea name="body" rows="8" />',
		);
		expect(
			PROMPTS.inputTranslate.system(minimalCtx("inputTranslate")),
		).not.toContain("<element_info>");
	});

	test("numbered instructions leave no gaps when an item is omitted", () => {
		const instructions = (system: string) =>
			system.match(/<instructions>\n([\s\S]*?)\n<\/instructions>/)?.[1] ?? "";

		const withoutPage = instructions(
			PROMPTS.translate.system(minimalCtx("translate")),
		);
		expect(withoutPage).toContain("1. You should translate");
		expect(withoutPage).not.toContain("2.");

		const withPage = instructions(
			PROMPTS.translate.system(fullCtx("translate")),
		);
		expect(withPage).toContain("2. Context of current page");
	});

	test("surrounding text brackets the target span", () => {
		expect(PROMPTS.translate.user(fullCtx("translate"))).toBe(
			"Seen immediately. <target>sample text</target> No CTA translation.",
		);
		expect(PROMPTS.translate.user(minimalCtx("translate"))).toBe(
			"<target>sample text</target>",
		);
	});

	test("the target language reaches every prompt", () => {
		for (const id of IDS) {
			expect(PROMPTS[id].system(minimalCtx(id))).toContain("日本語");
		}
	});
});

describe("rendered prompts", () => {
	for (const id of IDS) {
		test(`${id} minimal`, () => {
			const ctx = minimalCtx(id);
			expect({
				system: PROMPTS[id].system(ctx),
				user: PROMPTS[id].user(ctx),
			}).toMatchSnapshot();
		});

		test(`${id} full`, () => {
			const ctx = fullCtx(id);
			expect({
				system: PROMPTS[id].system(ctx),
				user: PROMPTS[id].user(ctx),
			}).toMatchSnapshot();
		});
	}
});
