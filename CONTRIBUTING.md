# Contributing

## Setup

```bash
git clone https://github.com/pmontp19/quiverai-ai-sdk-provider.git
cd quiverai-ai-sdk-provider
npm install
```

A pre-commit hook runs `biome check --write` on staged files automatically.

## Scripts

| Command | Description |
|---|---|
| `npm run check` | Lint and format check (biome) |
| `npm run check:fix` | Auto-fix lint and format issues |
| `npm run type-check` | TypeScript type checking |
| `npm test` | Run tests |
| `npm run build` | Build the package |

## Making changes

Every PR that affects the published package must include a **changeset** — a small file that describes what changed and the semver bump type.

```bash
npx changeset
```

This prompts you to select the bump type (`patch`, `minor`, or `major`) and write a short summary. It creates a markdown file in `.changeset/` that you commit alongside your code.

If you forget, the CI `changeset-check` job will fail on your PR as a reminder.

## Release flow

1. PRs with changesets are merged into `main`.
2. The Release workflow automatically opens a **"chore: version packages"** PR that bumps `version` in `package.json` and updates `CHANGELOG.md`.
3. When that PR is merged, the package is published to npm automatically.

## Adding a changeset retroactively

If a PR was already merged without a changeset, create one on a new branch:

```bash
git checkout -b chore/add-changeset
npx changeset
# select the bump type and describe the change that was already merged
git add .changeset/
git commit -m "chore: add missing changeset for <feature>"
```

Then open a PR. Once merged, the release PR will pick it up.
