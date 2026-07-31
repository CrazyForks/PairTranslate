import { describe, expect, test } from "bun:test";
import {
	isPresent,
	join,
	kv,
	lines,
	numbered,
	section,
	selfClosingTag,
	when,
} from "./text";

describe("join / lines", () => {
	test("join separates blocks with a blank line", () => {
		expect(join("a", "b")).toBe("a\n\nb");
	});

	test("lines separates with a single newline", () => {
		expect(lines("a", "b")).toBe("a\nb");
	});

	test("both drop undefined, null, false and empty strings", () => {
		expect(join("a", undefined, null, false, "", "b")).toBe("a\n\nb");
		expect(lines("a", undefined, null, false, "", "b")).toBe("a\nb");
	});

	test("all-empty collapses to an empty string", () => {
		expect(join(undefined, "")).toBe("");
		expect(lines()).toBe("");
	});
});

describe("isPresent / when", () => {
	test("treats empty values as absent", () => {
		for (const value of [undefined, null, false, "", [], {}]) {
			expect(isPresent(value)).toBe(false);
			expect(when(value, "x")).toBeUndefined();
		}
	});

	test("treats populated values as present", () => {
		for (const value of [true, "a", [1], { a: 1 }, 0]) {
			expect(isPresent(value)).toBe(true);
			expect(when(value, "x")).toBe("x");
		}
	});
});

describe("numbered", () => {
	test("numbers sequentially", () => {
		expect(numbered("a", "b", "c")).toBe("1. a\n2. b\n3. c");
	});

	test("renumbers after dropping empties, leaving no gaps", () => {
		expect(numbered("a", undefined, "c")).toBe("1. a\n2. c");
		expect(numbered(undefined, "only")).toBe("1. only");
	});
});

describe("section", () => {
	test("wraps a body in tags", () => {
		expect(section("task", "do it")).toBe("<task>\ndo it\n</task>");
	});

	test("joins an array body with newlines", () => {
		expect(section("task", ["one", "two"])).toBe("<task>\none\ntwo\n</task>");
	});

	test("returns undefined for an empty body, so the tag disappears", () => {
		expect(section("task", undefined)).toBeUndefined();
		expect(section("task", "")).toBeUndefined();
		expect(section("task", [undefined, ""])).toBeUndefined();
	});
});

describe("kv", () => {
	test("emits one entry per line, preserving insertion order", () => {
		expect(kv({ title: "T", domain: "example.com" })).toBe(
			"title: T\ndomain: example.com",
		);
	});

	test("skips empty values", () => {
		expect(kv({ title: "T", domain: undefined, extra: "" })).toBe("title: T");
	});

	test("returns undefined when absent or fully empty", () => {
		expect(kv(undefined)).toBeUndefined();
		expect(kv({})).toBeUndefined();
		expect(kv({ a: "" })).toBeUndefined();
	});
});

describe("selfClosingTag", () => {
	test("renders attributes", () => {
		expect(selfClosingTag("textarea", { name: "body", rows: "8" })).toBe(
			'<textarea name="body" rows="8" />',
		);
	});

	test("renders bare when there are no attributes", () => {
		expect(selfClosingTag("input")).toBe("<input />");
		expect(selfClosingTag("input", {})).toBe("<input />");
	});
});
