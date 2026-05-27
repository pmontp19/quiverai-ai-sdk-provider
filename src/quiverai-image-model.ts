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

type ImageRef = { url: string } | { base64: string };

export class QuiverAIImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3";
  readonly maxImagesPerCall = 16;

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
    const isVectorize = Boolean(hasFiles);

    let url: string;
    const body: Record<string, unknown> = {
      model: this.modelId,
      stream: false,
    };

    if (quiveraiOptions?.temperature != null) {
      body.temperature = quiveraiOptions.temperature;
    }
    if (quiveraiOptions?.topP != null) {
      body.top_p = quiveraiOptions.topP;
    }
    if (quiveraiOptions?.maxOutputTokens != null) {
      body.max_output_tokens = quiveraiOptions.maxOutputTokens;
    }
    if (quiveraiOptions?.presencePenalty != null) {
      body.presence_penalty = quiveraiOptions.presencePenalty;
    }

    if (isVectorize) {
      // biome-ignore lint/style/noNonNullAssertion: guarded by isVectorize check above
      const file = options.files![0];
      url = `${this.config.baseURL}/svgs/vectorizations`;
      body.image = fileToImageInput(file);
      if (options.files && options.files.length > 1) {
        warnings.push({
          type: "other",
          message: "Multiple files provided; only the first is vectorized.",
        });
      }
      if (quiveraiOptions?.autoCrop != null) {
        body.auto_crop = quiveraiOptions.autoCrop;
      }
      if (quiveraiOptions?.targetSize != null) {
        body.target_size = quiveraiOptions.targetSize;
      }
      if (options.n > 1) {
        warnings.push({
          type: "unsupported",
          feature: "n",
          details: "Vectorization does not support n > 1; generating 1 output.",
        });
      }
    } else {
      url = `${this.config.baseURL}/svgs/generations`;
      body.prompt = options.prompt ?? "";
      body.n = options.n;
      if (quiveraiOptions?.instructions) {
        body.instructions = quiveraiOptions.instructions;
      }
      if (
        quiveraiOptions?.references &&
        quiveraiOptions.references.length > 0
      ) {
        body.references = quiveraiOptions.references.map((ref) =>
          typeof ref === "string" ? { url: ref } : ref,
        );
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

    const encoder = new TextEncoder();
    const images = response.data.map((doc) => encoder.encode(doc.svg));

    return {
      images,
      warnings,
      response: {
        timestamp: currentDate,
        modelId: this.modelId,
        headers: responseHeaders,
      },
      providerMetadata: {
        quiverai: {
          images: response.data.map((doc) => ({
            mimeType: doc.mime_type ?? undefined,
          })),
          ...(response.credits != null && { credits: response.credits }),
        },
      },
    };
  }
}

function fileToImageInput(
  file: NonNullable<ImageModelV3CallOptions["files"]>[number],
): ImageRef {
  if (file.type === "url") {
    return { url: file.url };
  }
  const data = file.data;
  if (typeof data === "string") {
    return { base64: data };
  }
  return { base64: uint8ArrayToBase64(data) };
}
