# GitHub Figma Action

Automatically embed Figma design previews in GitHub PR descriptions with version info and timestamps.

## Features

- Scans PR descriptions for Figma URLs
- Fetches latest version and timestamp from Figma API
- Downloads and embeds images directly in PR description (base64)
- Prevents duplicate entries

## Installation

### Option 1: Reusable Workflow (Recommended)

1. In your repository, create `.github/workflows/figma-sync.yml`:

```yaml
name: Figma PR Sync

on:
  pull_request:
    types: [opened, edited]

jobs:
  figma-sync:
    uses: wildemat/github-figma-action/.github/workflows/reusable-figma-sync.yml@main
    secrets:
      FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
```

### Option 2: Copy Files

1. Copy the `.github` folder and `package.json` to your repository
2. Add `FIGMA_TOKEN` to your repository secrets

### Option 3: Git Subtree

```bash
git subtree add --prefix=.figma-action https://github.com/wildemat/github-figma-action.git main --squash
```

Then create `.github/workflows/figma-sync.yml`:

```yaml
name: Figma PR Sync

on:
  pull_request:
    types: [opened, edited]

jobs:
  sync-figma:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "21"
      - run: cd .figma-action && npm install
      - env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_BODY: ${{ github.event.pull_request.body }}
        run: node .figma-action/.github/scripts/figma-sync.js
```

## Setup

1. **Get Figma Token**: Go to Figma → Settings → Account → Personal access tokens
2. **Add Secret**: In your repository, go to Settings → Secrets → Actions → Add `FIGMA_TOKEN`
3. **Test**: Create a PR with a Figma URL in the description

## Supported URL Format

```
https://www.figma.com/design/FILE_ID/FILE_NAME?node-id=NODE_ID
```

Example:

```
https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344
```

## Output

The action will append this to your PR description:

```markdown
## Figma Design Reference

**Design Link:** [View in Figma](FIGMA_URL)

**Version:** 2260315635405056828

**Snapshot Timestamp:** 2025-09-05T14:29:08Z

**Preview:**
![Figma Design](data:image/png;base64,iVBOR...)
```
