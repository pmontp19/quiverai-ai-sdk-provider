import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
  resolve,
} from "@ai-sdk/provider-utils";
import {
  quiveraiFailedResponseHandler,
  quiveraiProviderOptionsSchema,
  quiveraiSvgResponseSchema,
  uint8ArrayToBase64,
} from "./quiverai-api";
import type { QuiverAIConfig } from "./quiverai-config";
import type { QuiverAIImageModelId } from "./quiverai-image-settings";

export type { QuiverAIProviderOptions as QuiverAIImageProviderOptions } from "./quiverai-api";

export class QuiverAIImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3";
  readonly maxImagesPerCall = 1;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: QuiverAIImageModelId,
    private readonly config: QuiverAIConfig,
  ) {}

  async doGenerate(
    options: ImageModelV3CallOptions,
  ): Promise<Awaited<ReturnType<ImageModelV3["doGenerate"]>>> {
    const warnings: Array<SharedV3Warning> = [];
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();

    if (options.size) {
      warnings.push({ type: "unsupported", feature: "size" });
    }
    if (options.aspectRatio) {
      warnings.push({ type: "unsupported", feature: "aspectRatio" });
    }
    if (options.seed != null) {
      warnings.push({ type: "unsupported", feature: "seed" });
    }
    if (options.mask) {
      warnings.push({ type: "unsupported", feature: "mask" });
    }

    const quiveraiOptions = await parseProviderOptions({
      provider: "quiverai",
      providerOptions: options.providerOptions,
      schema: quiveraiProviderOptionsSchema,
    });

    const hasFiles = options.files && options.files.length > 0;

    let url: string;
    let body: Record<string, unknown>;

    if (hasFiles) {
      // biome-ignore lint/style/noNonNullAssertion: guarded by hasFiles check above
      const file = options.files![0];
      const image = fileToImageInput(file);
      url = `${this.config.baseURL}/svgs/vectorizations`;
      body = {
        model: this.modelId,
        image,
        stream: false,
        n: options.n,
      };
      if (quiveraiOptions?.autoCrop != null) {
        body.auto_crop = quiveraiOptions.autoCrop;
      }
      if (quiveraiOptions?.targetSize != null) {
        body.target_size = quiveraiOptions.targetSize;
      }
      if (quiveraiOptions?.temperature != null) {
        body.temperature = quiveraiOptions.temperature;
      }
      if (quiveraiOptions?.topP != null) {
        body.top_p = quiveraiOptions.topP;
      }
      if (quiveraiOptions?.maxOutputTokens != null) {
        body.max_output_tokens = quiveraiOptions.maxOutputTokens;
      }
    } else {
      url = `${this.config.baseURL}/svgs/generations`;
      body = {
        model: this.modelId,
        prompt: options.prompt ?? "",
        stream: false,
        n: options.n,
      };
      if (quiveraiOptions?.instructions) {
        body.instructions = quiveraiOptions.instructions;
      }
      if (quiveraiOptions?.temperature != null) {
        body.temperature = quiveraiOptions.temperature;
      }
      if (quiveraiOptions?.topP != null) {
        body.top_p = quiveraiOptions.topP;
      }
      if (quiveraiOptions?.maxOutputTokens != null) {
        body.max_output_tokens = quiveraiOptions.maxOutputTokens;
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

    const svgStrings = response.data.map((doc) => doc.svg);
    const encoder = new TextEncoder();
    const images = svgStrings.map((svg) => encoder.encode(svg));

    return {
      images,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      usage: response.usage
        ? {
            inputTokens: response.usage.inputTokens ?? undefined,
            outputTokens: response.usage.outputTokens ?? undefined,
            totalTokens: response.usage.totalTokens ?? undefined,
          }
        : undefined,
      providerMetadata: {
        quiverai: {
          images: response.data.map((doc) => ({
            mimeType: doc.mimeType ?? undefined,
          })),
          ...(response.usage && {
            usage: {
              inputTokens: response.usage.inputTokens ?? undefined,
              outputTokens: response.usage.outputTokens ?? undefined,
              totalTokens: response.usage.totalTokens ?? undefined,
            },
          }),
        },
      },
    };
  }
}

function fileToImageInput(
  file: NonNullable<ImageModelV3CallOptions["files"]>[number],
) {
  if (file.type === "url") {
    return { url: file.url };
  }
  const data = file.data;
  if (typeof data === "string") {
    return { base64: data };
  }
  return { base64: uint8ArrayToBase64(data) };
}
