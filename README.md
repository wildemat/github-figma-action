# GitHub Figma PR Images

Automatically processes Figma design links in GitHub PR descriptions, replacing them with organized design specifications and previews.

## Features

- Scans PR descriptions for Figma URLs (above the Design Specs section)
- Fetches version info and timestamps from Figma API
- Replaces original Figma URLs with references to organized Design Specs section
- Downloads and embeds preview images with 30-day expiration
- Organizes all design specs in a dedicated section with collapsible details
- Prevents duplicate entries and maintains proper numbering

## Installation

### Option 1: Reusable Workflow (Recommended)

1. In your repository, create `.github/workflows/figma-pr-images.yml`:

```yaml
name: Figma PR Images

on:
  pull_request:
    types: [opened, edited]

jobs:
  figma-pr-images:
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

Then create `.github/workflows/figma-pr-images.yml`:

```yaml
name: Figma PR Images

on:
  pull_request:
    types: [opened, edited]

jobs:
  figma-pr-images:
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
        run: node .figma-action/.github/scripts/figma-pr-images.js
```

## Setup

1. **Get Figma Token**: Go to Figma → Settings → Account → Personal access tokens
2. **Add Secret**: In your repository, go to Settings → Secrets → Actions → Add `FIGMA_TOKEN`
3. **Test**: Create a PR with a Figma URL in the description

## How It Works

### 1. Adding Figma Links
Paste Figma design URLs **above** the `## Design Specs` section in your PR description. The script will only process links that appear before this section.

### 2. Supported URL Formats
```
https://www.figma.com/design/FILE_ID/FILE_NAME?node-id=NODE_ID
```

Examples:
- Standalone URL: `https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344`
- Markdown link: `[New homepage design](https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344)`

### 3. Processing Behavior

**Before processing:**
```markdown
Here's the new design: https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344

And [another view](https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3185-7339)
```

**After processing:**
```markdown
Here's the new design: [Refer to Design Spec 1 below](#spec-1)

And another view ([Refer to Design Spec 2 below](#spec-2))

## Design Specs

### Design Spec 1

<kbd><img alt="Figma Design Preview" src="https://figma-alpha-api.s3.us-west-2.amazonaws.com/..." /></kbd>

<details>
<summary>spec details</summary>

**Design Link:** <a href="https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/?node-id=3143-20344&version-id=2260315635405056828&m=dev" target="_blank">View in Figma</a>

**Version:** 2260315635405056828

**Snapshot Timestamp:** 2025-09-05T14:29:08Z

**Image Expires:** 2025-10-05

</details>

### Design Spec 2

<!-- ... similar structure ... -->

<!-- END_DESIGN_SPECS - WILL NOT DETECT FIGMA LINKS BELOW THIS LINE -->
```

## Design Specs Section Requirements

### Section Heading Format
The script looks for this **exact** heading format (case-insensitive):
```markdown
## Design Specs
```

### Hidden End Marker
The script automatically adds a hidden HTML comment to mark the end of the Design Specs section:
```html
<!-- END_DESIGN_SPECS - WILL NOT DETECT FIGMA LINKS BELOW THIS LINE -->
```

⚠️ **Important**: If you manually move or edit the Design Specs section, ensure you also move this end marker. The script uses this marker to:
- Determine where to append new design specs
- Count existing design specs for proper numbering
- Avoid processing Figma links that appear below this marker

### Link Processing Rules

1. **Only processes links above the Design Specs section** - Links below the section are ignored
2. **Maintains existing numbering** - New specs continue from the highest existing number
3. **Handles both formats**:
   - Standalone URLs → `[Refer to Design Spec X below](#spec-x)`
   - Markdown links `[text](url)` → `text ([Refer to Design Spec X below](#spec-x))`
4. **Creates section if missing** - If no Design Specs section exists, creates one at the end
5. **Uses existing version if specified** - If URL contains `version-id` parameter, uses that instead of fetching latest

### Image Expiration
- Figma API image URLs expire after **30 days**
- The expiration date is displayed in each design spec
- After expiration, images will show as broken links but the Figma design links remain functional
