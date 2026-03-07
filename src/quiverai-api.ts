import {
  createJsonErrorResponseHandler,
  lazySchema,
  zodSchema,
} from '@ai-sdk/provider-utils';
import type { InferSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const quiveraiErrorSchema = z.object({
  code: z.string().nullish(),
  message: z.string().nullish(),
  status: z.number().nullish(),
});

export const quiveraiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: quiveraiErrorSchema,
  errorToMessage: error =>
    `${error.code ?? 'unknown_error'} - ${error.message ?? 'Unknown error'}`,
});

export const quiveraiSvgResponseSchema = z.object({
  id: z.string(),
  created: z.number(),
  data: z.array(
    z.object({
      mimeType: z.string().nullish(),
      svg: z.string(),
    }),
  ),
  usage: z
    .object({
      inputTokens: z.number().nullish(),
      outputTokens: z.number().nullish(),
      totalTokens: z.number().nullish(),
    })
    .nullish(),
});

// Shared across language and image models
export const quiveraiProviderOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      instructions: z.string().optional(),
      temperature: z.number().optional(),
      topP: z.number().optional(),
      maxOutputTokens: z.number().int().optional(),
      autoCrop: z.boolean().optional(),
      targetSize: z.number().int().optional(),
    }),
  ),
);

export type QuiverAIProviderOptions = InferSchema<
  typeof quiveraiProviderOptionsSchema
>;

export function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
