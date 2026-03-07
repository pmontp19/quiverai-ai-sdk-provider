import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  SharedV3Warning,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createJsonResponseHandler,
  generateId,
  parseProviderOptions,
  postJsonToApi,
  postToApi,
  resolve,
  safeParseJSON,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import {
  quiveraiFailedResponseHandler,
  quiveraiProviderOptionsSchema,
  quiveraiSvgResponseSchema,
  uint8ArrayToBase64,
} from './quiverai-api';
import type { QuiverAIConfig } from './quiverai-config';
import { QuiverAIError } from './quiverai-error';
import type { QuiverAIImageModelId } from './quiverai-image-settings';

export type { QuiverAIProviderOptions as QuiverAILanguageProviderOptions } from './quiverai-api';

export class QuiverAILanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3';
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
  ): Promise<Awaited<ReturnType<LanguageModelV3['doGenerate']>>> {
    const { prompt, warnings, quiveraiOptions, hasImages, imageInput } =
      await this.getArgs(options);

    let url: string;
    let body: Record<string, unknown>;

    if (hasImages && imageInput) {
      url = `${this.config.baseURL}/svgs/vectorizations`;
      body = {
        model: this.modelId,
        image: imageInput,
        stream: false,
        n: 1,
      };
      if (quiveraiOptions?.autoCrop != null) {
        body.auto_crop = quiveraiOptions.autoCrop;
      }
      if (quiveraiOptions?.targetSize != null) {
        body.target_size = quiveraiOptions.targetSize;
      }
      if (options.temperature != null) {
        body.temperature = options.temperature;
      } else if (quiveraiOptions?.temperature != null) {
        body.temperature = quiveraiOptions.temperature;
      }
      if (options.topP != null) {
        body.top_p = options.topP;
      } else if (quiveraiOptions?.topP != null) {
        body.top_p = quiveraiOptions.topP;
      }
      if (options.maxOutputTokens != null) {
        body.max_output_tokens = options.maxOutputTokens;
      } else if (quiveraiOptions?.maxOutputTokens != null) {
        body.max_output_tokens = quiveraiOptions.maxOutputTokens;
      }
      if (options.presencePenalty != null) {
        body.presence_penalty = options.presencePenalty;
      }
    } else {
      url = `${this.config.baseURL}/svgs/generations`;
      body = {
        model: this.modelId,
        prompt,
        stream: false,
        n: 1,
      };
      if (quiveraiOptions?.instructions) {
        body.instructions = quiveraiOptions.instructions;
      }
      if (options.temperature != null) {
        body.temperature = options.temperature;
      } else if (quiveraiOptions?.temperature != null) {
        body.temperature = quiveraiOptions.temperature;
      }
      if (options.topP != null) {
        body.top_p = options.topP;
      } else if (quiveraiOptions?.topP != null) {
        body.top_p = quiveraiOptions.topP;
      }
      if (options.maxOutputTokens != null) {
        body.max_output_tokens = options.maxOutputTokens;
      } else if (quiveraiOptions?.maxOutputTokens != null) {
        body.max_output_tokens = quiveraiOptions.maxOutputTokens;
      }
      if (options.presencePenalty != null) {
        body.presence_penalty = options.presencePenalty;
      }
    }

    const { value: response } = await postJsonToApi({
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

    const svgText = response.data[0]?.svg ?? '';

    return {
      content: [{ type: 'text', text: svgText }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: {
          total: response.usage?.inputTokens ?? undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: response.usage?.outputTokens ?? undefined,
          text: undefined,
          reasoning: undefined,
        },
      },
      warnings,
      response: {
        id: response.id,
        timestamp: new Date(response.created * 1000),
        modelId: this.modelId,
      },
      providerMetadata: response.usage
        ? {
            quiverai: {
              usage: {
                inputTokens: response.usage.inputTokens ?? undefined,
                outputTokens: response.usage.outputTokens ?? undefined,
                totalTokens: response.usage.totalTokens ?? undefined,
              },
            },
          }
        : undefined,
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV3['doStream']>>> {
    const { prompt, warnings, quiveraiOptions, hasImages, imageInput } =
      await this.getArgs(options);

    const isVectorize = hasImages && imageInput;
    const endpoint = isVectorize
      ? `${this.config.baseURL}/svgs/vectorizations`
      : `${this.config.baseURL}/svgs/generations`;

    const body: Record<string, unknown> = {
      model: this.modelId,
      stream: true,
      n: 1,
    };

    if (options.temperature != null) {
      body.temperature = options.temperature;
    } else if (quiveraiOptions?.temperature != null) {
      body.temperature = quiveraiOptions.temperature;
    }
    if (options.topP != null) {
      body.top_p = options.topP;
    } else if (quiveraiOptions?.topP != null) {
      body.top_p = quiveraiOptions.topP;
    }
    if (options.maxOutputTokens != null) {
      body.max_output_tokens = options.maxOutputTokens;
    } else if (quiveraiOptions?.maxOutputTokens != null) {
      body.max_output_tokens = quiveraiOptions.maxOutputTokens;
    }
    if (options.presencePenalty != null) {
      body.presence_penalty = options.presencePenalty;
    }

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
      if (quiveraiOptions?.instructions) {
        body.instructions = quiveraiOptions.instructions;
      }
    }

    const { value: fetchResponse } = await postToApi({
      url: endpoint,
      headers: combineHeaders(await resolve(this.config.headers), {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
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
    let lastUsage: SvgUsage | undefined;
    let lastId: string | undefined;
    const textId = generateId();
    const reasoningId = generateId();
    const modelId = this.modelId;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        controller.enqueue({ type: 'stream-start', warnings });

        let hasError = false;
        try {
          for await (const sseEvent of parseSseStream(responseBody)) {
            if (sseEvent.data === '[DONE]') break;

            const parsed = await safeParseJSON({ text: sseEvent.data });
            if (!parsed.success) continue;
            const data = parsed.value as RawSseData;

            const eventType = sseEvent.event ?? data.type;
            if (data.id) lastId = data.id;
            if (data.usage) lastUsage = data.usage;

            switch (eventType) {
              case 'generating': {
                if (data.reasoning) {
                  if (!reasoningStarted) {
                    reasoningStarted = true;
                    controller.enqueue({
                      type: 'reasoning-start',
                      id: reasoningId,
                    });
                  }
                  controller.enqueue({
                    type: 'reasoning-delta',
                    id: reasoningId,
                    delta: data.reasoning,
                  });
                }
                break;
              }

              case 'reasoning': {
                if (!reasoningStarted) {
                  reasoningStarted = true;
                  controller.enqueue({
                    type: 'reasoning-start',
                    id: reasoningId,
                  });
                }
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: reasoningId,
                  delta: data.text ?? data.reasoning ?? '',
                });
                break;
              }

              case 'draft': {
                if (reasoningStarted) {
                  reasoningStarted = false;
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: reasoningId,
                  });
                }
                if (!textStarted) {
                  textStarted = true;
                  controller.enqueue({ type: 'text-start', id: textId });
                }
                controller.enqueue({
                  type: 'text-delta',
                  id: textId,
                  delta: data.svg ?? '',
                });
                break;
              }

              case 'content': {
                if (reasoningStarted) {
                  reasoningStarted = false;
                  controller.enqueue({
                    type: 'reasoning-end',
                    id: reasoningId,
                  });
                }
                if (!textStarted) {
                  // No draft events received — emit the full SVG now
                  textStarted = true;
                  controller.enqueue({ type: 'text-start', id: textId });
                  controller.enqueue({
                    type: 'text-delta',
                    id: textId,
                    delta: data.svg ?? '',
                  });
                }
                // Draft events already streamed all fragments; content SVG
                // is just the final complete version — only emit text-end
                textEnded = true;
                controller.enqueue({ type: 'text-end', id: textId });
                break;
              }
            }
          }
        } catch (error) {
          hasError = true;
          controller.enqueue({ type: 'error', error });
        }

        if (!hasError) {
          // Cleanup for abnormal stream termination
          if (reasoningStarted) {
            controller.enqueue({ type: 'reasoning-end', id: reasoningId });
          }
          if (textStarted && !textEnded) {
            controller.enqueue({ type: 'text-end', id: textId });
          }

          controller.enqueue({
            type: 'response-metadata',
            id: lastId,
            timestamp: new Date(),
            modelId,
          });

          controller.enqueue({
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: {
                total: lastUsage?.inputTokens,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: lastUsage?.outputTokens,
                text: undefined,
                reasoning: undefined,
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

    if (options.responseFormat && options.responseFormat.type !== 'text') {
      warnings.push({
        type: 'unsupported',
        feature: 'responseFormat',
        details: 'QuiverAI only supports text response format',
      });
    }
    if (options.tools && options.tools.length > 0) {
      warnings.push({
        type: 'unsupported',
        feature: 'tools',
        details: 'QuiverAI does not support tool calling',
      });
    }
    if (options.frequencyPenalty != null) {
      warnings.push({ type: 'unsupported', feature: 'frequencyPenalty' });
    }
    if (options.stopSequences && options.stopSequences.length > 0) {
      warnings.push({ type: 'unsupported', feature: 'stopSequences' });
    }
    if (options.topK != null) {
      warnings.push({ type: 'unsupported', feature: 'topK' });
    }
    if (options.seed != null) {
      warnings.push({ type: 'unsupported', feature: 'seed' });
    }

    const quiveraiOptions = await parseProviderOptions({
      provider: 'quiverai',
      providerOptions: options.providerOptions,
      schema: quiveraiProviderOptionsSchema,
    });

    const prompt = extractTextPrompt(options.prompt);
    const { hasImages, imageInput } = extractImageFromPrompt(options.prompt);

    return { prompt, warnings, quiveraiOptions, hasImages, imageInput };
  }
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
      throw new QuiverAIError({ message: 'Response body is null' });
    }
    return {
      value: response.body,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    };
  };
}

function extractTextPrompt(
  prompt: LanguageModelV3CallOptions['prompt'],
): string {
  const parts: string[] = [];
  for (const message of prompt) {
    if (message.role === 'system') {
      parts.push(message.content);
    } else if (message.role === 'user') {
      for (const part of message.content) {
        if (part.type === 'text') {
          parts.push(part.text);
        }
      }
    }
  }
  return parts.join('\n');
}

function extractImageFromPrompt(prompt: LanguageModelV3CallOptions['prompt']): {
  hasImages: boolean;
  imageInput: { url: string } | { base64: string } | undefined;
} {
  for (const message of prompt) {
    if (message.role === 'user') {
      for (const part of message.content) {
        if (part.type === 'file' && part.mediaType.startsWith('image/')) {
          const data = part.data;
          if (typeof data === 'string') {
            if (data.startsWith('http://') || data.startsWith('https://')) {
              return { hasImages: true, imageInput: { url: data } };
            }
            return { hasImages: true, imageInput: { base64: data } };
          }
          if (data instanceof URL) {
            return {
              hasImages: true,
              imageInput: { url: data.toString() },
            };
          }
          if (data instanceof Uint8Array) {
            return {
              hasImages: true,
              imageInput: { base64: uint8ArrayToBase64(data) },
            };
          }
        }
      }
    }
  }
  return { hasImages: false, imageInput: undefined };
}

interface SvgUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface RawSseData {
  type?: string;
  id?: string;
  svg?: string;
  text?: string;
  reasoning?: string;
  usage?: SvgUsage;
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
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.trim()) continue;

        let event: string | undefined;
        const dataLines: string[] = [];

        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6));
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5));
          }
        }

        if (dataLines.length > 0) {
          yield { event, data: dataLines.join('\n') };
        }
      }
    }

    // Process any remaining content in the buffer (stream closed without trailing \n\n)
    if (buffer.trim()) {
      let event: string | undefined;
      const dataLines: string[] = [];

      for (const line of buffer.split('\n')) {
        if (line.startsWith('event: ')) {
          event = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLines.push(line.slice(6));
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5));
        }
      }

      if (dataLines.length > 0) {
        yield { event, data: dataLines.join('\n') };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
