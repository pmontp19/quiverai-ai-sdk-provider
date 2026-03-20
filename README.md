# quiverai-ai-provider

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

## Language Models

Use `streamText` or `generateText` to receive SVG markup as text output. Streaming is especially
useful for progressive rendering — each token is a small SVG fragment you can render live in
the browser as it arrives.

### Streaming

```ts
import { quiverai } from 'quiverai-ai-provider';
import { streamText } from 'ai';

const result = streamText({
  model: quiverai('arrow-preview'),
  prompt: 'A red circle with a blue border',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk); // progressive SVG markup
}

console.log('Usage:', await result.usage);
```

### Non-streaming

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateText } from 'ai';

const { text, usage } = await generateText({
  model: quiverai('arrow-preview'),
  prompt: 'A red circle with a blue border',
});

console.log(text); // complete SVG markup
```

### Vectorization (image → SVG)

Include an image file part in the prompt to convert a raster image to SVG:

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateText } from 'ai';
import { readFileSync } from 'node:fs';

const { text } = await generateText({
  model: quiverai('arrow-preview'),
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

### Model Capabilities

| Model | Text-to-SVG | Image-to-SVG | Streaming |
|---|:---:|:---:|:---:|
| `arrow-preview` | ✓ | ✓ | ✓ |

### Unsupported Features

The following AI SDK parameters are not supported and will produce a warning if provided:
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

const { images } = await generateImage({
  model: quiverai.image('arrow-preview'),
  prompt: 'A red circle with a blue border',
});

const decoder = new TextDecoder();
for (const image of images) {
  console.log(decoder.decode(image.uint8Array)); // SVG markup
  writeFileSync(`output-${Date.now()}.svg`, image.uint8Array);
}
```

### Vectorization (image → SVG)

```ts
import { quiverai } from 'quiverai-ai-provider';
import { generateImage } from 'ai';
import { readFileSync } from 'node:fs';

const { images } = await generateImage({
  model: quiverai.image('arrow-preview'),
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
  model: quiverai('arrow-preview'),
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
| `instructions` | `string` | Additional style/quality instructions appended to the prompt (text-to-SVG only). |
| `temperature` | `number` | Controls randomness. |
| `topP` | `number` | Nucleus sampling threshold. |
| `maxOutputTokens` | `number` | Maximum tokens to generate. |
| `autoCrop` | `boolean` | Auto-crop source image before vectorization. |
| `targetSize` | `number` | Target output size in pixels (vectorization only). |

## Provider Metadata

```ts
const { images, providerMetadata } = await generateImage({
  model: quiverai.image('arrow-preview'),
  prompt: 'A red circle with a blue border',
});

console.log(providerMetadata?.quiverai);
// {
//   images: [{ mimeType: 'image/svg+xml' }],
//   usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
// }
```

> **Note:** QuiverAI currently returns `0` for all token counts (`inputTokens`, `outputTokens`, `totalTokens`). Pricing is a fixed cost per generation, not token-based.

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

Apache-2.0
