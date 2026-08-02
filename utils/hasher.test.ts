import { describe, expect, test } from "bun:test";
import { computeCacheKey } from "./hasher";
import { PROMPT_REVISION } from "./prompt/id";
import type { TranslateContext } from "./types";

const hex = async (...args: Parameters<typeof computeCacheKey>) =>
	Buffer.from(await computeCacheKey(...args)).toString("hex");

const PAGE = { title: "Some title", domain: "example.com" };

describe("computeCacheKey", () => {
	test("is stable for identical inputs", async () => {
		const args = [
			"translate",
			"gpt",
			"hello",
			{ page: PAGE },
			"en",
			"ja",
		] as const;
		expect(await hex(...args)).toBe(await hex(...args));
	});

	test("separates on prompt, model, text and languages", async () => {
		const base = await hex("translate", "gpt", "hello", {}, "en", "ja");
		expect(await hex("explain", "gpt", "hello", {}, "en", "ja")).not.toBe(base);
		expect(await hex("translate", "claude", "hello", {}, "en", "ja")).not.toBe(
			base,
		);
		expect(await hex("translate", "gpt", "world", {}, "en", "ja")).not.toBe(
			base,
		);
		expect(await hex("translate", "gpt", "hello", {}, "de", "ja")).not.toBe(
			base,
		);
		expect(await hex("translate", "gpt", "hello", {}, "en", "de")).not.toBe(
			base,
		);
	});

	test("ignores page title but separates on domain", async () => {
		const a = await hex("translate", "gpt", "hi", { page: PAGE });
		const differentTitle = await hex("translate", "gpt", "hi", {
			page: { ...PAGE, title: "Another title" },
		});
		const differentDomain = await hex("translate", "gpt", "hi", {
			page: { ...PAGE, domain: "other.com" },
		});
		// Title is deliberately excluded, for hit rate.
		expect(differentTitle).toBe(a);
		expect(differentDomain).not.toBe(a);
	});

	test("separates on surrounding text", async () => {
		const bare = await hex("translate", "gpt", "hi", {});
		expect(
			await hex("translate", "gpt", "hi", { surr: { before: "x " } }),
		).not.toBe(bare);
		expect(
			await hex("translate", "gpt", "hi", { surr: { after: " y" } }),
		).not.toBe(bare);
	});

	test("separates on the focused element, so form fields do not collide", async () => {
		const asElement = (attrs: Record<string, string>) =>
			({ element: { tag: "textarea", attrs } }) as unknown as TranslateContext;

		const subject = await hex(
			"inputTranslate",
			"gpt",
			"hi",
			asElement({ name: "subject" }),
		);
		const body = await hex(
			"inputTranslate",
			"gpt",
			"hi",
			asElement({ name: "body" }),
		);
		const otherTag = await hex("inputTranslate", "gpt", "hi", {
			element: { tag: "input", attrs: { name: "subject" } },
		} as unknown as TranslateContext);

		expect(body).not.toBe(subject);
		expect(otherTag).not.toBe(subject);
	});

	test("element attribute order does not change the key", async () => {
		const one = await hex("inputTranslate", "gpt", "hi", {
			element: { tag: "input", attrs: { a: "1", b: "2" } },
		} as unknown as TranslateContext);
		const other = await hex("inputTranslate", "gpt", "hi", {
			element: { tag: "input", attrs: { b: "2", a: "1" } },
		} as unknown as TranslateContext);
		expect(other).toBe(one);
	});

	test("separates on the dictionary headword", async () => {
		const bank = await hex("dictionaryTranslate", "gpt", "a definition", {
			word: "bank",
		} as unknown as TranslateContext);
		const bench = await hex("dictionaryTranslate", "gpt", "a definition", {
			word: "bench",
		} as unknown as TranslateContext);
		expect(bench).not.toBe(bank);
	});

	test("array text is keyed as a whole, distinctly from its join", async () => {
		const arr = await hex("batchTranslate", "gpt", ["a", "b"], {});
		expect(arr).not.toBe(await hex("batchTranslate", "gpt", ["b", "a"], {}));
		expect(arr).not.toBe(await hex("batchTranslate", "gpt", "ab", {}));
	});

	test("defaults empty text rather than throwing", async () => {
		expect(await hex("translate", "gpt", undefined, {})).toBe(
			await hex("translate", "gpt", "", {}),
		);
	});

	test("includes PROMPT_REVISION, so editing a prompt invalidates old entries", async () => {
		const D = "‌";
		const digest = async (str: string) =>
			Buffer.from(
				await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)),
			).toString("hex");

		const actual = await hex("translate", "gpt", "hello", {});
		// Same key material with the revision bumped must not collide.
		expect(actual).toBe(
			await digest(`r${PROMPT_REVISION}${D}translate${D}gpt${D}hello${D}`),
		);
		expect(actual).not.toBe(
			await digest(`r${PROMPT_REVISION + 1}${D}translate${D}gpt${D}hello${D}`),
		);
	});
});
