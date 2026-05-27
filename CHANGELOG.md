# quiverai-ai-provider

## 0.3.0

### Minor Changes

- [#18](https://github.com/pmontp19/quiverai-ai-sdk-provider/pull/18) [`16c2e46`](https://github.com/pmontp19/quiverai-ai-sdk-provider/commit/16c2e469013881115de166a3a8a223fc876c46c6) Thanks [@pmontp19](https://github.com/pmontp19)! - Support Arrow 1.0, 1.1, and 1.1 Max models; credits billing; prompt references

  - Add model IDs `arrow-1`, `arrow-1.1`, `arrow-1.1-max` (replaces `arrow-preview`, which has been retired).
  - Surface per-request `credits` via `providerMetadata.quiverai.credits` on both `doGenerate` and the final streaming `content` event. The deprecated token-based `usage` (always `0` from the API) is no longer populated.
  - Add `references` support: text + image prompt parts are sent as `references` on generations; also available via `providerOptions.quiverai.references`.
  - Expose `presencePenalty` via `providerOptions.quiverai`.
  - Bump `ImageModelV3.maxImagesPerCall` to 16 (generation). Vectorization still produces one output and warns when `n > 1`.
  - Fix: response `mime_type` (snake_case) is now parsed correctly (previously the `mimeType` field was never populated).
  - Fix: drop `n` from vectorization request body (not part of the vectorize schema).
  - Error envelope updated to match the API: `{ status, code, message, request_id }` with typed error codes (`invalid_request`, `invalid_api_key`, `unauthorized`, `rate_limit_exceeded`, `weekly_limit_exceeded`, `insufficient_credits`, `account_frozen`, `model_not_found`, `upstream_error`, `internal_error`). The `request_id` is included in the thrown error message.

## 0.2.4

### Patch Changes

- [#10](https://github.com/pmontp19/quiverai-ai-sdk-provider/pull/10) [`9a31441`](https://github.com/pmontp19/quiverai-ai-sdk-provider/commit/9a314417e211658128cda8d691ef55d0847e792b) Thanks [@pmontp19](https://github.com/pmontp19)! - Bump vitest to v4.1.0 and zod to v4.3.6

## 0.2.3

### Patch Changes

- [`bd7eb45`](https://github.com/pmontp19/quiverai-ai-sdk-provider/commit/bd7eb452230dbf09fe822fc5d9b1a7aa48efde16) Thanks [@pmontp19](https://github.com/pmontp19)! - Add MIT LICENSE file, README badges (npm, CI, license), and .nvmrc

## 0.2.2

### Patch Changes

- [`74397ea`](https://github.com/pmontp19/quiverai-ai-sdk-provider/commit/74397eacfa5c4a2b42cf2c2f28e0cc7ecdd640e4) Thanks [@pmontp19](https://github.com/pmontp19)! - Add biome for linting and formatting, changesets for automated versioning, and CI workflows for PRs
