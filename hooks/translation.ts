import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	type Setter,
	untrack,
} from "solid-js";
import { createStore } from "solid-js/store";
import {
	convertGenericError,
	createTranslateError,
	type TranslateError,
	TranslateErrorType,
} from "~/utils/errors";
import { t } from "~/utils/i18n";
import type { PromptCtxExtra } from "~/utils/prompt/ctx";
import type { PromptId, PromptOutput } from "~/utils/prompt/id";
import { mightUseProgressIndicator } from "./progress-indicator";

type Pending = {
	(): undefined;
	loading: true;
	error: undefined;
};
type Error = {
	(): undefined;
	loading: false;
	error: TranslateError;
};
type Success<T> = {
	(): T;
	loading: false;
	error: undefined;
};
type Result<T> = Pending | Error | Success<T>;

type BatchReturn = readonly [
	() => Result<string>[],
	retry: (index?: number) => void,
];

type TranslateUnaryPayload<T> =
	| T
	| {
			output: T;
			reasoning?: string;
	  };

const normalizeUnaryResponse = <T>(
	resp: TranslateUnaryPayload<T>,
): { output: T; reasoning?: string } => {
	if (resp && typeof resp === "object" && "output" in resp) {
		return resp as { output: T; reasoning?: string };
	}
	return {
		output: resp as T,
		reasoning: undefined,
	};
};

type TranslationStreamChunk = {
	content?: string;
	reasoning?: string;
};

const noModelError = () =>
	createTranslateError(
		TranslateErrorType.MODEL_NOT_FOUND,
		t("errors.translationModelRequired"),
	);
const batchMissingEntryError = (index: number) =>
	createTranslateError(
		TranslateErrorType.VALIDATION_ERROR,
		`The model returned no translation for paragraph ${index}`,
	);

/** Batch translation needs a prompt whose parsed output is one entry per input. */
type BatchPromptId = {
	[Id in PromptId]: PromptOutput<Id> extends (string | undefined)[]
		? Id
		: never;
}[PromptId];

export function createBatchTranslation<Id extends BatchPromptId>(
	text: () => string[],
	options: {
		promptId: Id;
		modelId: () => string | undefined;
		srcLang: () => string | undefined;
		dstLang: () => string;
		thinCache?: boolean;
		ctx?: () => PromptCtxExtra<Id>;
	},
): BatchReturn {
	const promptId = options.promptId;
	const modelId = options.modelId;
	const srcLang = options.srcLang;
	const dstLang = options.dstLang;
	const ctx = options.ctx || (() => ({}) as PromptCtxExtra<Id>);
	const thinCache = options.thinCache ?? true;
	const progressCtx = mightUseProgressIndicator();

	const [textResult, setTextResult] = createStore<(string | undefined)[]>([]);
	const [error, setError] = createStore<(TranslateError | undefined)[]>([]);

	const setAllError = (e: TranslateError, len: number) =>
		batch(() => {
			setError({ to: len - 1 }, e);
			setTextResult({ to: len - 1 }, undefined);
		});

	const setAllLoading = (len: number) =>
		batch(() => {
			setError({ to: len - 1 }, undefined);
			setTextResult({ to: len - 1 }, undefined);
		});

	/**
	 * Apply a sparse batch result. Each slot is keyed to its input index, so a
	 * hole marks exactly the paragraph the model dropped and every other
	 * translation stays paired with the right original.
	 */
	const setResultTexts = (texts: (string | undefined)[], expected: number) =>
		batch(() => {
			for (let i = 0; i < expected; i++) {
				const value = texts[i];
				if (value) {
					setError(i, undefined);
					setTextResult(i, value);
				} else {
					setError(i, batchMissingEntryError(i));
					setTextResult(i, undefined);
				}
			}
		});
	const clearAll = () =>
		batch(() => {
			setError([]);
			setTextResult([]);
		});

	const translate = (texts: string[], cleanCache = false) => {
		const modelId_ = modelId();
		if (modelId_ === undefined) {
			setAllError(noModelError(), texts.length);
			return;
		}

		const endTracking = progressCtx?.beginRequest(modelId_);
		setAllLoading(texts.length);

		const abortController = new AbortController();
		window.rpc
			.unary(
				ctx(),
				{
					modelId: modelId_,
					promptId,
					srcLang: srcLang() || "auto",
					dstLang: dstLang(),
					cleanCache,
					thinCache,
				},
				texts,
				abortController.signal,
			)
			.then((resp) => {
				const normalized = normalizeUnaryResponse<(string | undefined)[]>(resp);
				const translated = Array.isArray(normalized.output)
					? normalized.output
					: [normalized.output];
				setResultTexts(translated, texts.length);
			})
			.catch((e) => {
				if (abortController.signal.aborted) return;
				setAllError(convertGenericError(e), texts.length);
			})
			.finally(() => endTracking?.());

		onCleanup(() => abortController.abort());
	};

	const translateSingle = (index: number, text_: string) => {
		const modelId_ = modelId();
		if (modelId_ === undefined) {
			batch(() => {
				setError(index, noModelError());
				setTextResult(index, undefined);
			});
			return;
		}

		const endTracking = progressCtx?.beginRequest(modelId_);
		batch(() => {
			setError(index, undefined);
			setTextResult(index, undefined);
		});

		const abortController = new AbortController();
		window.rpc
			.unary(
				ctx(),
				{
					modelId: modelId_,
					promptId,
					srcLang: srcLang() || "auto",
					dstLang: dstLang(),
					cleanCache: true,
				},
				text_,
				abortController.signal,
			)
			.then((resp) => {
				const normalized = normalizeUnaryResponse<string | string[]>(resp);
				const value = Array.isArray(normalized.output)
					? normalized.output[0]
					: normalized.output;
				batch(() => {
					setError(index, undefined);
					setTextResult(index, value);
				});
			})
			.catch((e) => {
				if (abortController.signal.aborted) return;
				batch(() => {
					setError(index, convertGenericError(e));
					setTextResult(index, undefined);
				});
			})
			.finally(() => endTracking?.());
		onCleanup(() => abortController.abort());
	};

	createEffect(() => {
		const text_ = text();
		translate(text_);
		onCleanup(clearAll);
	});

	const retry = (index: number | undefined) => {
		const text_ = text();
		if (text_.length === 0) return;

		if (index === undefined) {
			translate(text_, true);
		} else if (index >= 0 && index < text_.length) {
			translateSingle(index, text_[index]);
		}
	};

	const ret = createMemo(() => {
		const len = text().length;
		return untrack(() =>
			Array.from({ length: len }, (_, i) => {
				function read(): string | undefined {
					return textResult[i];
				}

				Object.defineProperties(read, {
					error: {
						get() {
							return error[i];
						},
					},
					loading: {
						get() {
							// Access each store explicitly to track reactivity
							const hasResult = textResult[i] !== undefined;
							const hasError = error[i] !== undefined;
							return !hasResult && !hasError;
						},
					},
				});

				return read as Result<string>;
			}),
		);
	});

	return [ret, retry];
}

type ResultWithReasoning<T> = Result<T> & { reasoning?: string };
type SingleReturn<T> = readonly [ResultWithReasoning<T>, retry: () => void];
type SingleStreamReturn<T> = readonly [
	ResultWithReasoning<T> & { len: number; streaming: boolean },
	retry: () => void,
];

/**
 * Streaming accumulates raw text chunks, so the result is always a string —
 * parsing structured output is the caller's business.
 */
export function createTranslation<Id extends PromptId>(
	text: () => string,
	options: {
		stream: true;
		promptId: Id;
		modelId: () => string | undefined;
		srcLang: () => string | undefined;
		dstLang: () => string;
		ctx?: () => PromptCtxExtra<Id>;
	},
): SingleStreamReturn<string>;
/** A completed request resolves to whatever the prompt's `parse` produces. */
export function createTranslation<Id extends PromptId>(
	text: () => string,
	options: {
		stream?: false;
		modelId: () => string | undefined;
		srcLang: () => string | undefined;
		dstLang: () => string;
		promptId: Id;
		ctx?: () => PromptCtxExtra<Id>;
	},
): SingleReturn<PromptOutput<Id>>;
export function createTranslation<T>(
	text: () => string,
	options: {
		stream?: boolean;
		promptId: PromptId;
		modelId: () => string | undefined;
		srcLang: () => string | undefined;
		dstLang: () => string;
		ctx?: () => Record<string, unknown>;
	},
): SingleReturn<T> | SingleStreamReturn<T> {
	const modelId = options.modelId;
	const srcLang = options.srcLang;
	const dstLang = options.dstLang;
	const promptId = options.promptId;
	const ctx = options.ctx || (() => ({}));
	const isStream = options.stream ?? false;
	const progressCtx = mightUseProgressIndicator();

	const [result, setResult] = createSignal<T>();
	const [error, setError] = createSignal<TranslateError>();
	const [reasoning, setReasoning] = createSignal<string>();

	const [len, setLen] = isStream ? createSignal(0) : [() => 0, () => {}];
	const [streaming, setStreaming] = isStream
		? createSignal(false)
		: [() => false, () => {}];

	const setLoading = () =>
		batch(() => {
			setError(undefined);
			setResult(undefined);
			setReasoning(undefined);
		});

	const setResultVal = (val: T, reasoning?: string) =>
		batch(() => {
			setError(undefined);
			setResult(() => val);
			setReasoning(reasoning);
		});

	const setErrorVal = (e: TranslateError) =>
		batch(() => {
			setError(e);
			setResult(undefined);
			setReasoning(undefined);
		});

	const translateStream = async (text_: string, cleanCache?: boolean) => {
		const modelId_ = modelId();
		if (modelId_ === undefined) {
			setErrorVal(noModelError());
			return;
		}

		const endTracking = progressCtx?.beginRequest(modelId_);
		setLoading();

		const abortController = new AbortController();
		const listener = window.rpc.stream(
			ctx(),
			{
				modelId: modelId_,
				promptId,
				srcLang: srcLang() || "auto",
				dstLang: dstLang(),
				cleanCache,
			},
			text_,
			abortController.signal,
		);
		onCleanup(() => abortController.abort());

		try {
			setLen(0);
			setStreaming(true);
			for await (const chunk of listener as AsyncGenerator<TranslationStreamChunk>) {
				batch(() => {
					setError(undefined);
					const content = chunk.content;
					const reasoning = chunk.reasoning;
					if (content) {
						// The streaming overload pins the result to `string`; inside this
						// shared implementation body `T` is still generic.
						(setResult as unknown as Setter<string>)(
							(prev) => (prev || "") + content,
						);
						setLen((prev: number) => prev + content.length);
					}
					if (reasoning) {
						setReasoning((prev) => (prev || "") + reasoning);
						setLen((prev: number) => prev + reasoning.length);
					}
				});
			}
		} catch (e) {
			if (abortController.signal.aborted) return;
			setErrorVal(convertGenericError(e));
		} finally {
			endTracking?.();
			setStreaming(false);
		}
	};

	const translateUnary = async (text_: string, cleanCache?: boolean) => {
		const modelId_ = modelId();
		if (modelId_ === undefined) {
			setErrorVal(noModelError());
			return;
		}

		const endTracking = progressCtx?.beginRequest(modelId_);
		setLoading();

		const abortController = new AbortController();
		window.rpc
			.unary(
				ctx(),
				{
					modelId: modelId_,
					promptId,
					srcLang: srcLang() || "auto",
					dstLang: dstLang(),
					cleanCache,
				},
				text_,
				abortController.signal,
			)
			.then((resp) => {
				const normalized = normalizeUnaryResponse<T>(resp);
				setResultVal(normalized.output, normalized.reasoning);
			})
			.catch((e) => {
				if (abortController.signal.aborted) return;
				setErrorVal(convertGenericError(e));
			})
			.finally(() => endTracking?.());

		onCleanup(() => abortController.abort());
	};

	const doTranslate = (text_: string, cleanCache?: boolean) =>
		isStream
			? translateStream(text_, cleanCache)
			: translateUnary(text_, cleanCache);

	createEffect(() => {
		const text_ = text();
		if (!text_) {
			return;
		}
		onCleanup(() =>
			batch(() => {
				setError(undefined);
				setResult(undefined);
				setReasoning(undefined);
			}),
		);
		doTranslate(text_);
	});

	const retry = () => {
		const text_ = text();
		if (text_.length === 0) return;
		doTranslate(text_, true);
	};

	function read(): T | undefined {
		return result();
	}

	Object.defineProperties(read, {
		error: {
			get: error,
		},
		reasoning: {
			get: reasoning,
		},
		loading: {
			get: () => {
				// Access each signal explicitly to track reactivity
				const hasResult = result() !== undefined;
				const hasError = error() !== undefined;
				return !hasResult && !hasError;
			},
		},
		...(options.stream && {
			len: {
				get: len,
			},
			streaming: {
				get: streaming,
			},
		}),
	});

	return [read as ResultWithReasoning<T>, retry];
}
