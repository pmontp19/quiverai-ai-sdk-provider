---
"quiverai-ai-provider": minor
---

Support Arrow 1.0, 1.1, and 1.1 Max models; credits billing; prompt references

- Add model IDs `arrow-1`, `arrow-1.1`, `arrow-1.1-max` (replaces `arrow-preview`, which has been retired).
- Surface per-request `credits` via `providerMetadata.quiverai.credits` on both `doGenerate` and the final streaming `content` event. The deprecated token-based `usage` (always `0` from the API) is no longer populated.
- Add `references` support: text + image prompt parts are sent as `references` on generations; also available via `providerOptions.quiverai.references`.
- Expose `presencePenalty` via `providerOptions.quiverai`.
- Bump `ImageModelV3.maxImagesPerCall` to 16 (generation). Vectorization still produces one output and warns when `n > 1`.
- Fix: response `mime_type` (snake_case) is now parsed correctly (previously the `mimeType` field was never populated).
- Fix: drop `n` from vectorization request body (not part of the vectorize schema).
- Error envelope updated to match the API: `{ status, code, message, request_id }` with typed error codes (`invalid_request`, `invalid_api_key`, `unauthorized`, `rate_limit_exceeded`, `weekly_limit_exceeded`, `insufficient_credits`, `account_frozen`, `model_not_found`, `upstream_error`, `internal_error`). The `request_id` is included in the thrown error message.
