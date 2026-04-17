# quiverai-ai-provider

[![npm version](https://img.shields.io/npm/v/quiverai-ai-provider)](https://www.npmjs.com/package/quiverai-ai-provider)
[![CI](https://github.com/pmontp19/quiverai-ai-sdk-provider/actions/workflows/ci.yml/badge.svg)](https://github.com/pmontp19/quiverai-ai-sdk-provider/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/quiverai-ai-provider)](./LICENSE)

[QuiverAI](https://quiver.ai/) provider for the [Vercel AI SDK](https://ai-sdk.dev/).

QuiverAI generates scalable vector graphics (SVG) from text prompts and images. SVG is an interesting edge case in AI generation: it is plain text (XML markup) that renders as a vector image. That duality means you can use it through two different AI SDK interfaces — `streamText` / `generateText` if you want a progressive streaming UX where the SVG builds up character by character, or `generateImage` if you prefer the more natural "give me an image" API. Both are supported.

## Installation

```bash
npm install quiverai-ai-provider ai
```

```bash
pnpm add quiverai-ai-provider ai
```

## Provider Instance

```ts
import { quiverai } from 'quiverai-ai-provider';
```

For a customized setup:

```ts
import { createQuiverAI } from 'quiverai-ai-provider';

const quiverai = createQuiverAI({
  apiKey: 'your-api-key', // defaults to QUIVERAI_API_KEY env var
  baseURL: 'custom-url', // optional, defaults to https://api.quiver.ai/v1
  headers: { /* custom headers */ }, // optional
});
```

### Settings

| Option | Type | Description |
|---|---|---|
| `apiKey` | `string` | API key sent as `Authorization: Bearer`. Defaults to `QUIVERAI_API_KEY`. |
| `baseURL` | `string` | Override the API base URL. |
| `headers` | `Record<string, string>` | Extra headers included in every request. |
| `fetch` | `FetchFunction` | Custom fetch implementation (useful for testing/proxying). |

## Models

| Model ID | Name | Generate (credits) | Vectorize (credits) | Max references |
|---|---|:---:|:---:|:---:|
| `arrow-1` | Arrow 1.0 | 30 | 30 | 4 |
| `arrow-1.1` | Arrow 1.1 | 20 | 15 | 4 |
| `arrow-1.1-max` | Arrow 1.1 Max | 25 | 20 | 16 |

All models support text-to-SVG, image-to-SVG (vectorization), and streaming.

## Language Models

Use `streamText` or `generateText` to receive SVG markup as text output. Streaming is especially
useful for progressive rendering — each token is a small SVG fragment you can render live in
the browser as it arrives.

### Streaming

```ts
import { quiverai } from 'quiverai-ai-provider';
import { streamText } from 'ai';

const result = streamText({
  model: quiverai('arrow-1.1'),
  prompt: 'A red circle with a blue border',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk); // progressive SVG markup
}
```

### Non-streaming

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateText } from 'ai';

const { text, providerMetadata } = await generateText({
  model: quiverai('arrow-1.1'),
  prompt: 'A red circle with a blue border',
});

console.log(text); // complete SVG markup
console.log(providerMetadata?.quiverai); // { credits: 20 }
```

### Vectorization (image → SVG)

Include an image file part in the prompt — with no accompanying text — to convert a raster
image to SVG:

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateText } from 'ai';
import { readFileSync } from 'node:fs';

const { text } = await generateText({
  model: quiverai('arrow-1.1'),
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'file',
          data: readFileSync('logo.png'),
          mediaType: 'image/png',
        },
      ],
    },
  ],
});

console.log(text); // SVG markup of the vectorized image
```

### References (text + image → SVG)

If the prompt contains **both text and image file parts**, the model generates a new SVG
guided by the image(s) as visual references. You can also pass references via
`providerOptions.quiverai.references`:

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: quiverai('arrow-1.1-max'),
  prompt: 'A minimalist badge in the style of these references',
  providerOptions: {
    quiverai: {
      references: [
        'https://example.com/ref1.png',
        { url: 'https://example.com/ref2.png' },
      ],
    },
  },
});
```

### Unsupported Features

These AI SDK parameters are ignored and produce a warning:
`tools`, `responseFormat`, `stopSequences`, `topK`, `seed`, `frequencyPenalty`.

## Image Models

Use `generateImage` for a conventional image generation workflow. The SVG is returned as a
`Uint8Array` containing UTF-8 encoded markup — write it directly to a `.svg` file or decode
it to a string.

### Basic Usage

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateImage } from 'ai';
import { writeFileSync } from 'node:fs';

const { images, providerMetadata } = await generateImage({
  model: quiverai.image('arrow-1.1'),
  prompt: 'A red circle with a blue border',
});

const decoder = new TextDecoder();
for (const image of images) {
  writeFileSync(`output-${Date.now()}.svg`, image.uint8Array);
  console.log(decoder.decode(image.uint8Array));
}

console.log(providerMetadata?.quiverai.credits); // e.g. 20
```

### Multiple outputs

Generations (text-to-SVG) support up to 16 outputs per call via `n`:

```ts
const { images } = await generateImage({
  model: quiverai.image('arrow-1.1'),
  prompt: 'Variants of a minimalist coffee logo',
  n: 4,
});
```

Vectorization only supports a single output.

### Vectorization (image → SVG)

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateImage } from 'ai';
import { readFileSync } from 'node:fs';

const { images } = await generateImage({
  model: quiverai.image('arrow-1.1'),
  prompt: '',
  files: [
    {
      type: 'file',
      data: readFileSync('logo.png'),
      mediaType: 'image/png',
    },
  ],
  providerOptions: {
    quiverai: {
      autoCrop: true,
      targetSize: 512,
    },
  },
});
```

## Provider Options

Pass QuiverAI-specific options via `providerOptions.quiverai` on any call:

```ts
import { quiverai, type QuiverAILanguageProviderOptions } from 'quiverai-ai-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: quiverai('arrow-1.1'),
  prompt: 'A minimalist logo for a coffee shop',
  providerOptions: {
    quiverai: {
      instructions: 'flat design, monochrome, geometric shapes only',
      temperature: 0.7,
      maxOutputTokens: 4096,
    } satisfies QuiverAILanguageProviderOptions,
  },
});
```

| Option | Type | Description |
|---|---|---|
| `instructions` | `string` | Additional style/quality instructions (text-to-SVG only). |
| `temperature` | `number` | Sampling temperature (0–2). |
| `topP` | `number` | Nucleus sampling threshold (0–1). |
| `maxOutputTokens` | `number` | Upper bound for output token count. |
| `presencePenalty` | `number` | Penalty for tokens already present (-2 to 2). |
| `references` | `Array<string \| {url} \| {base64}>` | Reference images for text-to-SVG. Max 4 for `arrow-1`/`arrow-1.1`, 16 for `arrow-1.1-max`. |
| `autoCrop` | `boolean` | Auto-crop source image before vectorization. |
| `targetSize` | `number` | Square resize target in pixels (128–4096) for vectorization. |

## Billing & Credits

QuiverAI bills per request in **credits** (not tokens). Each completed request returns a
`credits` value in `providerMetadata.quiverai.credits` — both for `doGenerate` and on the
final `content` event of a stream.

```ts
const { providerMetadata } = await generateText({ model: quiverai('arrow-1.1'), prompt });
console.log(providerMetadata?.quiverai.credits); // e.g. 20
```

The AI SDK `usage` object (input/output tokens) is not populated — QuiverAI does not report
tokens.

## Errors

Errors are thrown as `APICallError` with the following QuiverAI error codes surfaced in the
message:

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Malformed body or invalid parameters |
| 401 | `unauthorized` / `invalid_api_key` | Missing or invalid API key |
| 402 | `insufficient_credits` | Organization is out of credits |
| 403 | `account_frozen` | Account is frozen |
| 404 | `model_not_found` | Unknown model ID |
| 429 | `rate_limit_exceeded` / `weekly_limit_exceeded` | Retry after `Retry-After` seconds |
| 500 | `internal_error` | Server error |
| 502/503 | `upstream_error` | Upstream processing failure |

Each error includes a `request_id` for support. The AI SDK's `APICallError.isRetryable`
automatically flags 429/5xx as retryable.

## Contributing

### Setup

```bash
git clone https://github.com/pmontp19/quiverai-ai-sdk-provider.git
cd quiverai-ai-sdk-provider
npm install
```

A pre-commit hook runs `biome check --write` on staged files automatically.

### Scripts

| Command | Description |
|---|---|
| `npm run check` | Lint and format check (biome) |
| `npm run check:fix` | Auto-fix lint and format issues |
| `npm run type-check` | TypeScript type checking |
| `npm test` | Run tests |
| `npm run build` | Build the package |

### Making changes

Every PR that affects the published package must include a **changeset** — a small file that describes what changed and the semver bump type.

```bash
npx changeset
```

This prompts you to select the bump type (`patch`, `minor`, or `major`) and write a short summary. It creates a markdown file in `.changeset/` that you commit alongside your code.

If you forget, the CI `changeset-check` job will fail on your PR as a reminder.

### Release flow

1. PRs with changesets are merged into `main`.
2. The Release workflow automatically opens a **"chore: version packages"** PR that bumps `version` in `package.json` and updates `CHANGELOG.md`.
3. When that PR is merged, the package is published to npm automatically.

### Adding a changeset retroactively

If a PR was already merged without a changeset, create one on a new branch:

```bash
git checkout -b chore/add-changeset
npx changeset
# select the bump type and describe the change that was already merged
git add .changeset/
git commit -m "chore: add missing changeset for <feature>"
```

Then open a PR. Once merged, the release PR will pick it up.

## License

MIT
