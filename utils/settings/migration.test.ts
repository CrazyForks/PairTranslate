import { beforeAll, describe, expect, mock, test } from "bun:test";
import { SETTINGS_VERSION } from "./version";

/**
 * `migration.ts` reaches `./default` → `~/utils/{language,i18n}`, which depend
 * on `#imports` and `@wxt-dev/i18n` — both only real inside the extension
 * build. Stub the pieces the migration path actually touches. Default settings
 * only use `t()` for service display names, so echoing the key back is enough.
 */
mock.module("#imports", () => ({
	browser: {
		i18n: { getUILanguage: () => "en-US", getMessage: (key: string) => key },
		storage: { local: { get: async () => ({}), set: async () => {} } },
	},
}));

mock.module("~/utils/i18n", () => ({
	t: (key: string) => key,
}));

let migrateSettings: (raw: unknown) => Record<string, unknown>;

beforeAll(async () => {
	({ migrateSettings } = await import("./migration"));
});

const basic = () => ({
	enabled: true,
	theme: "system" as const,
	selectionPopupEnabled: true,
	autoPin: false,
	floatingBallEnabled: true,
	floatingBallPosition: { side: "right" as const, top: 20 },
	keyboardShortcutEnabled: true,
	keyboardShortcut: "Alt+T",
	selectionTranslateEnabled: true,
	selectionTranslateModifier: "Alt" as const,
	inputTranslateEnabled: true,
	progressIndicationEnabled: true,
	translationStyle: { bold: false, italic: false, underline: false },
});

const translate = () => ({
	sourceLang: "auto",
	targetLang: "ja",
	filterInteractive: true,
	translationMode: "parallel" as const,
	inTextTranslateIconEnabled: true,
	translateFullPage: false,
	inputTranslateLang: "en",
});

const queue = () => ({
	requestConcurrency: 4,
	tokensPerMinute: 60000,
	maxBatchSize: 8,
	maxTokensPerBatch: 8000,
	cacheSize: 1000,
});

const debug = () => ({
	verboseLogging: false,
	traceLlms: false,
	traceTraditional: false,
	disableCache: false,
	simulateLatencyMs: 0,
});

/** A v3 blob, i.e. what an install on the previous release looks like. */
const v3Settings = () => ({
	__v: 3,
	basic: basic(),
	translate: translate(),
	services: {},
	queue: queue(),
	websiteRules: [],
	debug: debug(),
	prompts: {
		"8e6da19e-808e-4696-810c-e1c1fe2cd1fd": {
			name: "Translate",
			systemPrompt: "you are a translator",
			input: "string",
			output: "string",
			steps: [{ message: "{{text}}", output: "string" }],
		},
	},
});

describe("migrateSettings", () => {
	test("v3 upgrades to the current version and drops prompts", () => {
		const result = migrateSettings(v3Settings());
		expect(result.__v).toBe(SETTINGS_VERSION);
		expect(result).not.toHaveProperty("prompts");
	});

	test("v3 preserves the rest of the settings", () => {
		const result = migrateSettings(v3Settings());
		expect(result.translate).toMatchObject({ targetLang: "ja" });
		expect(result.queue).toMatchObject({ cacheSize: 1000 });
		expect(result.debug).toMatchObject({ simulateLatencyMs: 0 });
	});

	test("an already-current blob passes through untouched", () => {
		const { prompts: _dropped, ...current } = v3Settings();
		const result = migrateSettings({ ...current, __v: SETTINGS_VERSION });
		expect(result.__v).toBe(SETTINGS_VERSION);
		expect(result).not.toHaveProperty("prompts");
	});

	test("the full v0 chain completes without prompts", () => {
		const result = migrateSettings({
			basic: basic(),
			translate: {
				sourceLang: "auto",
				targetLang: "de",
				filterInteractive: true,
				concurrentRequests: 2,
				maxBatchSize: 5,
				cacheSize: 500,
				translationMode: "parallel",
				translateFullPage: false,
				inputTranslateLang: "en",
			},
			services: {
				llmServices: {
					"11111111-1111-4111-8111-111111111111": {
						name: "GPT",
						baseUrl: "https://api.openai.com/v1",
						apiSpec: "openai",
						model: "gpt-4o",
					},
				},
			},
			websiteRules: [],
		});

		expect(result.__v).toBe(SETTINGS_VERSION);
		expect(result).not.toHaveProperty("prompts");
		// Legacy queue values are carried across, not reset to defaults.
		expect(result.queue).toMatchObject({
			requestConcurrency: 2,
			maxBatchSize: 5,
			cacheSize: 500,
		});
		// The flat, tagged services record replaced the split maps.
		expect(
			(result.services as Record<string, { type: string }>)[
				"11111111-1111-4111-8111-111111111111"
			],
		).toMatchObject({ type: "llm", model: "gpt-4o" });
	});

	test("rejects a non-object payload", () => {
		expect(() => migrateSettings(null)).toThrow();
		expect(() => migrateSettings("nope")).toThrow();
	});
});
