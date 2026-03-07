import type { ImageModelV3, LanguageModelV3 } from '@ai-sdk/provider';
import { NoSuchModelError } from '@ai-sdk/provider';
import { loadApiKey } from '@ai-sdk/provider-utils';
import type { FetchFunction } from '@ai-sdk/provider-utils';
import { QuiverAIImageModel } from './quiverai-image-model';
import type { QuiverAIImageModelId } from './quiverai-image-settings';
import { QuiverAILanguageModel } from './quiverai-language-model';

const DEFAULT_BASE_URL = 'https://api.quiver.ai/v1';

export interface QuiverAIProviderSettings {
  /**
   * QuiverAI API key. Default value is taken from the `QUIVERAI_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Base URL for the API. Defaults to `https://api.quiver.ai/v1`.
   */
  baseURL?: string;

  /**
   * Custom headers to include in every request.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation.
   */
  fetch?: FetchFunction;

  /** @internal */
  _internal?: {
    currentDate?: () => Date;
  };
}

export interface QuiverAIProvider {
  (modelId: QuiverAIImageModelId): LanguageModelV3;
  readonly specificationVersion: 'v3';
  languageModel(modelId: QuiverAIImageModelId): LanguageModelV3;
  image(modelId: QuiverAIImageModelId): ImageModelV3;
  imageModel(modelId: QuiverAIImageModelId): ImageModelV3;
  embeddingModel(modelId: string): never;
  textEmbeddingModel(modelId: string): never;
}

export function createQuiverAI(
  options: QuiverAIProviderSettings = {},
): QuiverAIProvider {
  const baseURL = options.baseURL ?? DEFAULT_BASE_URL;

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'QUIVERAI_API_KEY',
      description: 'QuiverAI',
    })}`,
    ...options.headers,
  });

  const createLanguageModel = (modelId: QuiverAIImageModelId) =>
    new QuiverAILanguageModel(modelId, {
      provider: 'quiverai.languageModel',
      headers: getHeaders,
      baseURL,
      fetch: options.fetch,
    });

  const createImageModel = (modelId: QuiverAIImageModelId) =>
    new QuiverAIImageModel(modelId, {
      provider: 'quiverai.image',
      headers: getHeaders,
      baseURL,
      fetch: options.fetch,
      _internal: options._internal,
    });

  const embeddingModel = (modelId: string): never => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };

  const provider = function (modelId: QuiverAIImageModelId) {
    return createLanguageModel(modelId);
  };

  provider.specificationVersion = 'v3' as const;
  provider.languageModel = createLanguageModel;
  provider.image = createImageModel;
  provider.imageModel = createImageModel;
  provider.embeddingModel = embeddingModel;
  provider.textEmbeddingModel = embeddingModel;

  return provider as QuiverAIProvider;
}

export const quiverai = createQuiverAI();
