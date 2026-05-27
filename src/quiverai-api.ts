import type { InferSchema } from "@ai-sdk/provider-utils";
import {
  createJsonErrorResponseHandler,
  lazySchema,
  zodSchema,
} from "@ai-sdk/provider-utils";
import { z } from "zod/v4";

export const quiveraiErrorCodeSchema = z.enum([
  "invalid_request",
  "invalid_api_key",
  "unauthorized",
  "rate_limit_exceeded",
  "weekly_limit_exceeded",
  "insufficient_credits",
  "account_frozen",
  "model_not_found",
  "upstream_error",
  "internal_error",
]);

export type QuiverAIErrorCode = z.infer<typeof quiveraiErrorCodeSchema>;

const quiveraiErrorSchema = z.object({
  status: z.number().nullish(),
  code: z.union([quiveraiErrorCodeSchema, z.string()]).nullish(),
  message: z.string().nullish(),
  request_id: z.string().nullish(),
});

export const quiveraiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: quiveraiErrorSchema,
  errorToMessage: (error) => {
    const code = error.code ?? "unknown_error";
    const message = error.message ?? "Unknown error";
    const requestId = error.request_id
      ? ` (request_id: ${error.request_id})`
      : "";
    return `${code} - ${message}${requestId}`;
  },
});

const svgDocumentSchema = z.object({
  svg: z.string(),
  mime_type: z.string().nullish(),
});

export const quiveraiSvgResponseSchema = z.object({
  id: z.string(),
  created: z.number(),
  data: z.array(svgDocumentSchema),
  credits: z.number().int().nullish(),
});

const referenceSchema = z.union([
  z.string().url(),
  z.object({ url: z.string().url() }),
  z.object({ base64: z.string() }),
]);

// Shared across language and image models
export const quiveraiProviderOptionsSchema = lazySchema(() =>
  zodSchema(
    z.object({
      instructions: z.string().optional(),
      temperature: z.number().optional(),
      topP: z.number().optional(),
      maxOutputTokens: z.number().int().optional(),
      presencePenalty: z.number().optional(),
      autoCrop: z.boolean().optional(),
      targetSize: z.number().int().optional(),
      references: z.array(referenceSchema).max(16).optional(),
    }),
  ),
);

export type QuiverAIProviderOptions = InferSchema<
  typeof quiveraiProviderOptionsSchema
>;

export function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
