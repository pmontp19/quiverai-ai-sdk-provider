# Plan: Target ai@6 stable (no dual exports needed)

## Context

We originally assumed `LanguageModelV3` / `ImageModelV3` were only in the ai@7 beta.
Investigation revealed that the **stable** packages already have V3 types:

- `@ai-sdk/provider@3.0.8` (latest) exports `LanguageModelV3`, `ImageModelV3`, `SharedV3Warning`, etc.
- `@ai-sdk/provider-utils@4.0.19` (latest) exports all utilities we use (`postToApi`, `postJsonToApi`, etc.)
- `ai@6.0.116` (latest) defines `type LanguageModel = GlobalProviderModelId | LanguageModelV3 | LanguageModelV2`

The V3 types in stable are **identical** to those in beta. Our current implementation is already compatible with ai@6 — we just need to update the dependency versions.

**Dual export points are not needed.**

## Changes Required

### 1. `package.json` — update dependencies

```diff
  "dependencies": {
-   "@ai-sdk/provider": "^4.0.0-beta.0",
-   "@ai-sdk/provider-utils": "^5.0.0-beta.1"
+   "@ai-sdk/provider": "^3.0.8",
+   "@ai-sdk/provider-utils": "^4.0.19"
  },
```

### 2. `README.md` — remove beta warnings, simplify install

- Remove the "AI SDK v7 beta required" warning block
- Change install command to:
  ```
  npm install quiverai-ai-provider ai
  ```
- Remove all `@beta` dist-tag references

### 3. Verify build + tests still pass

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
npm test
```

## Verification

1. `npm run build` succeeds with stable deps
2. `npm test` passes
3. Create a quick test script importing from `ai@6` stable:
   ```ts
   import { quiverai } from 'quiverai-ai-provider';
   import { generateText } from 'ai';
   // Should compile without type errors
   ```
