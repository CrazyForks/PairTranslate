/**
 * String composition helpers for prompt definitions.
 *
 * Every helper drops empty parts, so a conditional section disappears without
 * leaving stray blank lines behind. That is what makes `when(...)` ergonomic
 * inside `join(...)` / `lines(...)` / `numbered(...)`.
 */

export type Part = string | undefined | null | false;

const keep = (parts: Part[]): string[] =>
	parts.filter(
		(part): part is string => typeof part === "string" && part !== "",
	);

/**
 * Truthiness test used by `when`. Mirrors the semantics of the template
 * engine's `{{#if}}`: empty strings, arrays and objects all count as absent.
 */
export const isPresent = (value: unknown): boolean => {
	if (value === null || value === undefined || value === false) return false;
	if (typeof value === "string") return value.length > 0;
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
 * Auto-numbered list. Numbering is assigned *after* empty parts are dropped,
 * so a conditional item never leaves a gap in the sequence.
 */
export const numbered = (...parts: Part[]): string =>
	keep(parts)
		.map((item, index) => `${index + 1}. ${item}`)
		.join("\n");

/** `<tag>\n…\n</tag>`, or `undefined` when the body is empty. */
export const section = (
	tag: string,
	body: Part | Part[],
): string | undefined => {
	const inner = Array.isArray(body) ? lines(...body) : keep([body])[0];
	return inner ? `<${tag}>\n${inner}\n</${tag}>` : undefined;
};

/** One `key: value` per line, skipping empty values. */
export const kv = (
	record?: Record<string, string | undefined>,
): string | undefined => {
	if (!record) return undefined;
	return (
		lines(
			...Object.entries(record).map(([key, value]) =>
				value ? `${key}: ${value}` : undefined,
			),
		) || undefined
	);
};

/** `<tag key="value" />` — used for the focused-element description. */
export const selfClosingTag = (
	tag: string,
	attrs?: Record<string, string>,
): string => {
	const rendered = Object.entries(attrs ?? {})
		.map(([key, value]) => `${key}="${value}"`)
		.join(" ");
	return rendered ? `<${tag} ${rendered} />` : `<${tag} />`;
};
