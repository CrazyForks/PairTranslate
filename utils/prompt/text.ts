/**
 * String composition helpers for prompt definitions.
 *
 * Every helper drops empty parts, so a conditional section disappears without
 * leaving stray blank lines behind. That is what makes `when(...)` ergonomic
 * inside `join(...)` / `lines(...)` / `numbered(...)`.
 */

/** Nestable, so a list can be built inline inside a `section` body. */
export type Part = string | undefined | null | false | Part[];

/**
 * Flatten nested parts and drop the empty ones. Hand-rolled rather than
 * `Array.prototype.flat(Infinity)`, whose return type on a recursive `Part`
 * makes TypeScript give up (TS2589).
 */
const keep = (parts: Part[]): string[] => {
	const out: string[] = [];
	const walk = (part: Part): void => {
		if (Array.isArray(part)) {
			for (const child of part) walk(child);
		} else if (typeof part === "string" && part !== "") {
			out.push(part);
		}
	};
	for (const part of parts) walk(part);
	return out;
};

/**
 * Truthiness test used by `when`. Empty strings, arrays and objects all count
 * as absent, and so does `0` — the common use is `when(list.length, …)`, where
 * a zero length must not render the conditional branch.
 */
export const isPresent = (value: unknown): boolean => {
	if (value === null || value === undefined || value === false) return false;
	if (typeof value === "string") return value.length > 0;
	if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "object")
		return Object.keys(value as Record<string, unknown>).length > 0;
	return true;
};

/** Blocks, separated by a blank line. */
export const join = (...parts: Part[]): string => keep(parts).join("\n\n");

/** Lines, separated by a single newline. */
export const lines = (...parts: Part[]): string => keep(parts).join("\n");

/** `value` when `cond` is present, otherwise `undefined`. */
export const when = <T>(cond: unknown, value: T): T | undefined =>
	isPresent(cond) ? value : undefined;

/**
 * Collapse each top-level part into one list item. A nested array is that
 * item's continuation lines, not further items — so `["intro", "  - detail"]`
 * gets a single marker, which is what indented sub-lists need.
 */
const items = (parts: Part[]): string[] =>
	parts
		.map((part) => (Array.isArray(part) ? lines(...part) : keep([part])[0]))
		.filter((item): item is string => Boolean(item));

/**
 * Auto-numbered list. Numbering is assigned *after* empty parts are dropped,
 * so a conditional item never leaves a gap in the sequence.
 */
export const numbered = (...parts: Part[]): string =>
	items(parts)
		.map((item, index) => `${index + 1}. ${item}`)
		.join("\n");

/** Bullet list, `+ ` prefixed. Numbering-free counterpart to `numbered`. */
export const bullets = (...parts: Part[]): string =>
	items(parts)
		.map((item) => `+ ${item}`)
		.join("\n");

/** `<tag>\n…\n</tag>`, or `undefined` when the body is empty. */
export const section = (tag: string, body: Part): string | undefined => {
	const inner = Array.isArray(body) ? lines(...body) : keep([body])[0];
	return inner ? `<${tag}>\n${inner}\n</${tag}>` : undefined;
};

const MAX_UNTRUSTED_LEN = 300;

/**
 * Neutralize a value that came from the page (title, meta tags, element
 * attributes) before it is interpolated into a prompt.
 *
 * These land inside the *system* message, so an unescaped `<` or `"` lets a
 * hostile page close the surrounding tag and append its own instructions. We
 * strip the tag/quote characters outright rather than entity-encode them: the
 * model reads this as prose, so `&lt;` would just be noise. Newlines collapse
 * so a single value cannot fake extra `key: value` lines, and the length cap
 * keeps a huge attribute from crowding out the real prompt.
 */
export const untrusted = (value: string): string =>
	value
		.replace(/[<>"']/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_UNTRUSTED_LEN);

/**
 * One `key: value` per line, skipping empty values. Values are treated as
 * untrusted, since the only caller renders page metadata.
 */
export const kv = (
	record?: Record<string, string | undefined>,
): string | undefined => {
	if (!record) return undefined;
	return (
		lines(
			...Object.entries(record).map(([key, value]) => {
				const clean = value ? untrusted(value) : "";
				return clean ? `${untrusted(key)}: ${clean}` : undefined;
			}),
		) || undefined
	);
};

/**
 * `<tag key="value" />` — used for the focused-element description. Returns
 * `undefined` for an empty tag name, matching `section`'s "disappear when there
 * is nothing to say" contract. Tag and attributes are page-controlled, so both
 * go through `untrusted`.
 */
export const selfClosingTag = (
	tag: string,
	attrs?: Record<string, string>,
): string | undefined => {
	const name = untrusted(tag);
	if (!name) return undefined;
	const rendered = Object.entries(attrs ?? {})
		.map(([key, value]): [string, string] => [untrusted(key), untrusted(value)])
		.filter(([key, value]) => key && value)
		.map(([key, value]) => `${key}="${value}"`)
		.join(" ");
	return rendered ? `<${name} ${rendered} />` : `<${name} />`;
};
