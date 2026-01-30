# Usage Guide

This guide walks you through the complete workflow for generating and printing custom Magic: The Gathering Jumpstart cards.

---

## Quick Start (Recommended)

For most users, simply run:

```bash
npm install                      # One-time setup
npx playwright install chromium  # One-time browser setup
npm run rebuild                  # Full build (~10-15 min)
```

This generates all card images (front and back) ready for printing. Skip to [Step 3: Print](#step-3-print-with-mpc-or-notmpc).

---

## Step 1: Generate Card Images

### Full Build (Recommended)

```bash
npm run rebuild
```

This runs all three phases:
1. **Convert**: Parse WOTC text files to JSON
2. **Generate**: Create Card Conjurer files and download front images
3. **Render**: Use Playwright to render card backs from CardConjurer.app

**Output:**
- `output/front-images/` - Card front images (e.g., `J22-front-0001-Blink-1.jpg`)
- `output/back-images/` - Card back images (e.g., `J22-back-0001-Blink-1.jpg`)

### Quick Build (Without Back Images)

```bash
npm run build
```

Use this for faster iteration when you don't need back images (~5-10 min vs ~10-15 min).

### Single Set Processing

```bash
node convert-wotc-txt-to-json.js "Avatar"   # Phase 1: Parse text files
node generate-card-conjurer-json.js TLA      # Phase 2: Generate front images
node render-card-backs.js TLA                # Phase 3: Render back images
```

---

## Step 2: Manual CardConjurer Workflow (Optional)

If you prefer to manually customize cards or the automated rendering fails, you can use CardConjurer directly.

1. **Visit** [CardConjurer](https://cardconjurer.app/)
2. **Navigate** to the **"Import/Save"** tab
3. **Upload your file** from `output/cardconjurer-import-files/`
4. **Download cards** manually or use the Greasemonkey script:
   - Install [Tampermonkey](https://www.tampermonkey.net/)
   - Install [Download All Cards on CardConjurer](https://greasyfork.org/en/scripts/560030-download-all-cards-on-cardconjurer)
   - Click the **"Download all"** button

---

## Step 3: Print with MPC or NotMPC

Using your generated images, order professional prints.

### What You Need

- **Card Fronts:** `output/front-images/*.jpg`
- **Card Backs:** `output/back-images/*.jpg`

### File Naming

Front and back images share the same naming pattern for easy matching:
- Front: `J22-front-0001-Blink-1.jpg`
- Back: `J22-back-0001-Blink-1.jpg`

### Ordering

Visit [NotMPC](https://notmpc.com/custom-game-cards/) or similar services and use their **double-sided game cards** option to upload your fronts and backs.

---

## Configuration

### Environment Variables

| Variable          | Default   | Description                                      |
| ----------------- | --------- | ------------------------------------------------ |
| `RENDER_PARALLEL` | Unlimited | Max number of sets to render in parallel         |
| `RENDER_PAGES`    | 4         | Number of parallel browser pages per set         |

**Examples:**

```bash
# Render all sets sequentially (lower memory usage)
RENDER_PARALLEL=1 npm run render

# Use 8 parallel pages per set (faster on powerful machines)
RENDER_PAGES=8 npm run render

# Single set with more parallelism
RENDER_PAGES=8 node render-card-backs.js J22
```

---

## Quick Reference

| Task                    | Command                              | Output                        |
| ----------------------- | ------------------------------------ | ----------------------------- |
| Full build (all images) | `npm run rebuild`                    | front-images + back-images    |
| Quick build (no backs)  | `npm run build`                      | front-images only             |
| Render backs only       | `npm run render`                     | back-images (all sets)        |
| Single set backs        | `node render-card-backs.js J22`      | back-images (one set)         |
| Clean output            | `npm run clean`                      | Deletes all generated files   |
