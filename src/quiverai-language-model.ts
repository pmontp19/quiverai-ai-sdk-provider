import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  SharedV3Warning,
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createJsonResponseHandler,
  generateId,
  parseProviderOptions,
  postJsonToApi,
  postToApi,
  resolve,
  safeParseJSON,
} from "@ai-sdk/provider-utils";
import {
  quiveraiFailedResponseHandler,
  quiveraiProviderOptionsSchema,
  quiveraiSvgResponseSchema,
  uint8ArrayToBase64,
} from "./quiverai-api";
import type { QuiverAIConfig } from "./quiverai-config";
import { QuiverAIError } from "./quiverai-error";
import type { QuiverAIImageModelId } from "./quiverai-image-settings";

export type { QuiverAIProviderOptions as QuiverAILanguageProviderOptions } from "./quiverai-api";

type ImageRef = { url: string } | { base64: string };

const emptyUsage = {
  inputTokens: {
    total: undefined,
    noCache: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: undefined,
    text: undefined,
    reasoning: undefined,
  },
} as const;

export class QuiverAILanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3";
  readonly supportedUrls: Record<string, RegExp[]> = {};

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: QuiverAIImageModelId,
    private readonly config: QuiverAIConfig,
  ) {}

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doGenerate"]>>> {
    const { prompt, warnings, quiveraiOptions, mode, imageInput, references } =
      await this.getArgs(options);

    const isVectorize = mode === "vectorize";
    const url = isVectorize
      ? `${this.config.baseURL}/svgs/vectorizations`
      : `${this.config.baseURL}/svgs/generations`;

    const body: Record<string, unknown> = {
      model: this.modelId,
      stream: false,
    };

    applySamplingParams(body, options, quiveraiOptions);

    if (isVectorize) {
      body.image = imageInput;
      if (quiveraiOptions?.autoCrop != null) {
        body.auto_crop = quiveraiOptions.autoCrop;
      }
      if (quiveraiOptions?.targetSize != null) {
        body.target_size = quiveraiOptions.targetSize;
      }
    } else {
      body.prompt = prompt;
      body.n = 1;
      if (quiveraiOptions?.instructions) {
        body.instructions = quiveraiOptions.instructions;
      }
      if (references && references.length > 0) {
        body.references = references;
      }
    }

    const { value: response, responseHeaders } = await postJsonToApi({
      url,
      headers: combineHeaders(
        await resolve(this.config.headers),
        options.headers,
      ),
      body,
      failedResponseHandler: quiveraiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        quiveraiSvgResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const svgText = response.data[0]?.svg ?? "";

    return {
      content: [{ type: "text", text: svgText }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: emptyUsage,
      warnings,
      response: {
        id: response.id,
        timestamp: new Date(response.created * 1000),
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: {
        quiverai: {
          ...(response.credits != null && { credits: response.credits }),
        },
      },
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3["doStream"]>>> {
    const { prompt, warnings, quiveraiOptions, mode, imageInput, references } =
      await this.getArgs(options);

    const isVectorize = mode === "vectorize";
    const endpoint = isVectorize
      ? `${this.config.baseURL}/svgs/vectorizations`
      : `${this.config.baseURL}/svgs/generations`;

    const body: Record<string, unknown> = {
      model: this.modelId,
      stream: true,
    };

    applySamplingParams(body, options, quiveraiOptions);

    if (isVectorize) {
      body.image = imageInput;
      if (quiveraiOptions?.autoCrop != null) {
        body.auto_crop = quiveraiOptions.autoCrop;
      }
      if (quiveraiOptions?.targetSize != null) {
        body.target_size = quiveraiOptions.targetSize;
      }
    } else {
      body.prompt = prompt;
      body.n = 1;
      if (quiveraiOptions?.instructions) {
        body.instructions = quiveraiOptions.instructions;
      }
      if (references && references.length > 0) {
        body.references = references;
      }
    }

    const { value: fetchResponse } = await postToApi({
      url: endpoint,
      headers: combineHeaders(await resolve(this.config.headers), {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...options.headers,
      }),
      body: {
        content: JSON.stringify(body),
        values: body,
      },
      failedResponseHandler: quiveraiFailedResponseHandler,
      successfulResponseHandler: createSseStreamResponseHandler(),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const responseBody = fetchResponse;
    let textStarted = false;
    let textEnded = false;
    let reasoningStarted = false;
    let lastCredits: number | undefined;
    let lastId: string | undefined;
    const textId = generateId();
    const reasoningId = generateId();
    const modelId = this.modelId;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        controller.enqueue({ type: "stream-start", warnings });

        let hasError = false;
        try {
          for await (const sseEvent of parseSseStream(responseBody)) {
            if (sseEvent.data === "[DONE]") break;

            const parsed = await safeParseJSON({ text: sseEvent.data });
            if (!parsed.success) continue;
            const data = parsed.value as RawSseData;

            const eventType = sseEvent.event ?? data.type;
            if (data.id) lastId = data.id;
            if (typeof data.credits === "number") lastCredits = data.credits;

            switch (eventType) {
              case "generating": {
                if (data.text) {
                  if (!reasoningStarted) {
                    reasoningStarted = true;
                    controller.enqueue({
                      type: "reasoning-start",
                      id: reasoningId,
                    });
                  }
                  controller.enqueue({
                    type: "reasoning-delta",
                    id: reasoningId,
                    delta: data.text,
                  });
                }
                break;
              }

              case "reasoning": {
                if (!reasoningStarted) {
                  reasoningStarted = true;
                  controller.enqueue({
                    type: "reasoning-start",
                    id: reasoningId,
                  });
                }
                controller.enqueue({
                  type: "reasoning-delta",
                  id: reasoningId,
                  delta: data.text ?? "",
                });
                break;
              }

              case "draft": {
                if (reasoningStarted) {
                  reasoningStarted = false;
                  controller.enqueue({
                    type: "reasoning-end",
                    id: reasoningId,
                  });
                }
                if (!textStarted) {
                  textStarted = true;
                  controller.enqueue({ type: "text-start", id: textId });
                }
                controller.enqueue({
                  type: "text-delta",
                  id: textId,
                  delta: data.svg ?? "",
                });
                break;
              }

              case "content": {
                if (reasoningStarted) {
                  reasoningStarted = false;
                  controller.enqueue({
                    type: "reasoning-end",
                    id: reasoningId,
                  });
                }
                if (!textStarted) {
                  // No draft events received — emit the full SVG now
                  textStarted = true;
                  controller.enqueue({ type: "text-start", id: textId });
                  controller.enqueue({
                    type: "text-delta",
                    id: textId,
                    delta: data.svg ?? "",
                  });
                }
                textEnded = true;
                controller.enqueue({ type: "text-end", id: textId });
                break;
              }
            }
          }
        } catch (error) {
          hasError = true;
          controller.enqueue({ type: "error", error });
        }

        if (!hasError) {
          if (reasoningStarted) {
            controller.enqueue({ type: "reasoning-end", id: reasoningId });
          }
          if (textStarted && !textEnded) {
            controller.enqueue({ type: "text-end", id: textId });
          }

          controller.enqueue({
            type: "response-metadata",
            id: lastId,
            timestamp: new Date(),
            modelId,
          });

          controller.enqueue({
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: emptyUsage,
            providerMetadata: {
              quiverai: {
                ...(lastCredits != null && { credits: lastCredits }),
              },
            },
          });
        }

        controller.close();
      },
    });

    return { stream };
  }

  private async getArgs(options: LanguageModelV3CallOptions) {
    const warnings: Array<SharedV3Warning> = [];

    if (options.responseFormat && options.responseFormat.type !== "text") {
      warnings.push({
        type: "unsupported",
        feature: "responseFormat",
        details: "QuiverAI only supports text response format",
      });
    }
    if (options.tools && options.tools.length > 0) {
      warnings.push({
        type: "unsupported",
        feature: "tools",
        details: "QuiverAI does not support tool calling",
      });
    }
    if (options.frequencyPenalty != null) {
      warnings.push({ type: "unsupported", feature: "frequencyPenalty" });
    }
    if (options.stopSequences && options.stopSequences.length > 0) {
      warnings.push({ type: "unsupported", feature: "stopSequences" });
    }
    if (options.topK != null) {
      warnings.push({ type: "unsupported", feature: "topK" });
    }
    if (options.seed != null) {
      warnings.push({ type: "unsupported", feature: "seed" });
    }

    const quiveraiOptions = await parseProviderOptions({
      provider: "quiverai",
      providerOptions: options.providerOptions,
      schema: quiveraiProviderOptionsSchema,
    });

    const prompt = extractTextPrompt(options.prompt);
    const promptImages = extractImagesFromPrompt(options.prompt);
    const hasText = prompt.length > 0;
    const hasImages = promptImages.length > 0;

    let mode: "generate" | "vectorize" = "generate";
    let imageInput: ImageRef | undefined;
    let references: ImageRef[] | undefined;

    if (!hasText && hasImages) {
      // Images only → vectorize with the first image
      mode = "vectorize";
      imageInput = promptImages[0];
      if (promptImages.length > 1) {
        warnings.push({
          type: "other",
          message: "Multiple images provided; only the first is vectorized.",
        });
      }
    } else if (hasImages) {
      // Text + images → generate with references
      mode = "generate";
      references = promptImages;
    }

    if (quiveraiOptions?.references && quiveraiOptions.references.length > 0) {
      const normalized = quiveraiOptions.references.map((ref) =>
        typeof ref === "string" ? { url: ref } : ref,
      );
      references = [...(references ?? []), ...normalized];
    }

    return {
      prompt,
      warnings,
      quiveraiOptions,
      mode,
      imageInput,
      references,
    };
  }
}

function applySamplingParams(
  body: Record<string, unknown>,
  options: LanguageModelV3CallOptions,
  quiveraiOptions:
    | (Awaited<ReturnType<typeof parseProviderOptions>> & {
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
        presencePenalty?: number;
      })
    | undefined,
) {
  const temperature = options.temperature ?? quiveraiOptions?.temperature;
  const topP = options.topP ?? quiveraiOptions?.topP;
  const maxOutputTokens =
    options.maxOutputTokens ?? quiveraiOptions?.maxOutputTokens;
  const presencePenalty =
    options.presencePenalty ?? quiveraiOptions?.presencePenalty;

  if (temperature != null) body.temperature = temperature;
  if (topP != null) body.top_p = topP;
  if (maxOutputTokens != null) body.max_output_tokens = maxOutputTokens;
  if (presencePenalty != null) body.presence_penalty = presencePenalty;
}

function createSseStreamResponseHandler() {
  return async ({
    response,
  }: {
    response: Response;
    url: string;
    requestBodyValues: unknown;
  }) => {
    if (!response.body) {
      throw new QuiverAIError({ message: "Response body is null" });
    }
    return {
      value: response.body,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    };
  };
}

function extractTextPrompt(
  prompt: LanguageModelV3CallOptions["prompt"],
): string {
  const parts: string[] = [];
  for (const message of prompt) {
    if (message.role === "system") {
      parts.push(message.content);
    } else if (message.role === "user") {
      for (const part of message.content) {
        if (part.type === "text") {
          parts.push(part.text);
        }
      }
    }
  }
  return parts.join("\n");
}

function extractImagesFromPrompt(
  prompt: LanguageModelV3CallOptions["prompt"],
): ImageRef[] {
  const images: ImageRef[] = [];
  for (const message of prompt) {
    if (message.role !== "user") continue;
    for (const part of message.content) {
      if (part.type !== "file") continue;
      if (!part.mediaType.startsWith("image/")) continue;

      const data = part.data;
      if (typeof data === "string") {
        if (data.startsWith("http://") || data.startsWith("https://")) {
          images.push({ url: data });
        } else {
          images.push({ base64: data });
        }
      } else if (data instanceof URL) {
        images.push({ url: data.toString() });
      } else if (data instanceof Uint8Array) {
        images.push({ base64: uint8ArrayToBase64(data) });
      }
    }
  }
  return images;
}

interface RawSseData {
  type?: string;
  id?: string;
  svg?: string;
  text?: string;
  credits?: number;
  [key: string]: unknown;
}

interface ParsedSseEvent {
  event?: string;
  data: string;
}

async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (!part.trim()) continue;

        let event: string | undefined;
        const dataLines: string[] = [];

        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataLines.push(line.slice(6));
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5));
          }
        }

        if (dataLines.length > 0) {
          yield { event, data: dataLines.join("\n") };
        }
      }
    }

    if (buffer.trim()) {
      let event: string | undefined;
      const dataLines: string[] = [];

      for (const line of buffer.split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          dataLines.push(line.slice(6));
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5));
        }
      }

      if (dataLines.length > 0) {
        yield { event, data: dataLines.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
