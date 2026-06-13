# Technical Documentation

This document contains detailed technical information for developers and users who want to run the MTG Jumpstart Card Generator locally.

## Architecture Overview

The generator works in a three-phase pipeline:

```
INPUT: txt-from-wotc/{set-name}/*.txt
  ↓
Phase 1: convert-wotc-txt-to-json.js
  ├─ Regex parsing: ^(\d+)\s+(.+)$
  ├─ Groups cards by pack (filename)  
  └─ Deduplicates and sums quantities
  ↓
Phase 2: generate-card-conjurer-json.js
  ├─ Queries Scryfall API (rate-limited 100ms)
  ├─ Downloads card images (672×936px)
  ├─ Processes with ImageMagick:
  │   • Overlays 28px black on borders
  │   • Adds 33px bleed border (final: 738×1002px)
  ├─ Generates Card Conjurer JSON from template
  └─ Calculates watermark positioning
  ↓
Phase 3: render-card-backs.js (Optional)
  ├─ Launches headless Chromium via Playwright
  ├─ Uploads .cardconjurer file to CardConjurer.app
  ├─ Iterates through saved cards dropdown
  ├─ Resets watermark and downloads each card
  └─ Saves rendered images with matching filenames
  ↓
OUTPUT:
├─ JSON files: Individual and bulk Card Conjurer files
├─ Front images: Face cards with pack contents  
└─ Back images: Themed artwork (if Phase 3 run)
```

## Prerequisites

### Required Software

- **Node.js** (v14 or higher)
  - Download: https://nodejs.org/
  - Verify installation: `node --version`

- **ImageMagick** - Image processing library
  - macOS: `brew install imagemagick`
  - Ubuntu/Debian: `sudo apt-get install imagemagick`
  - Windows: Download from https://imagemagick.org/script/download.php
  - Verify installation: `magick --version`

### Optional (for card back rendering)

- **Playwright** - Browser automation for rendering card backs
  - Installed automatically with `npm install`
  - After install: `npx playwright install chromium`

### System Requirements

- Internet connection (for Scryfall API access)
- ~500MB free disk space for generated files
- Scryfall API rate limit: 100ms delay between requests (handled automatically)

### Platform Notes

All npm scripts are cross-platform compatible and work on Windows, macOS, and Linux without requiring any special shell environment.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/mandreko/jumpstart-generator.git
cd jumpstart-generator
```

2. Install Node.js dependencies:
```bash
npm install
```

3. (Optional) Install browser for card back rendering:
```bash
npx playwright install chromium
```

## Usage

### Build Commands

| Command | Description | Time |
|---------|-------------|------|
| `npm run rebuild` | Full rebuild: clean + build + render | ~30-40 min |
| `npm run build` | Convert + generate (no render) | ~5-10 min |
| `npm run render` | Render card backs via Playwright | ~4-5 min |
| `npm run convert` | Phase 1: Parse WOTC text files | ~1 min |
| `npm run generate` | Phase 2: Generate Card Conjurer files | ~4-5 min |
| `npm run clean` | Delete all generated output files | <1 min |

**Note:** `rebuild` includes automated card back rendering via Playwright. Use `build` for faster iteration when you don't need back images.

### Single Set Processing

**Convert specific set's text files:**
```bash
node convert-wotc-txt-to-json.js "Avatar"
```

**Generate Card Conjurer files for specific set:**
```bash
node generate-card-conjurer-json.js TLA
```

Available set codes: `TLA`, `DMU`, `J25`, `J22`, `LTR`, `MOM`, `ONE`, `BRO`

### Performance Tuning

**Parallelization:** The render phase runs all sets in parallel by default. Control with environment variables:

```bash
# Limit parallel rendering (default: all sets at once)
RENDER_PARALLEL=2 npm run render

# Control browser pages per set (default: 4)  
RENDER_PAGES=2 npm run render
```

**With full parallelization:** ~4-5 minutes for all sets (vs ~25-30 min sequential)

## Configuration: sets.json

Master configuration for all 8 supported sets. Each entry contains:
- `background-watermark`: SVG URL from github.com/pappnu/mtg-vectors
- `lower-watermark`: Set symbol SVG URL
- `intermediate-json`: Output filename for Phase 1

Set codes: `TLA`, `DMU`, `J25`, `J22`, `LTR`, `MOM`, `ONE`, `BRO`

## Core Processing (generate-card-conjurer-json.js)

This 1,044-line file is the main processing engine. Key components:

### Caching System
- **ScryfallCache**: Two maps prevent redundant API calls
  - `cardDataCache`: card name → {name, mana_cost, type_line}
  - `packCardCache`: "{set}:{packName}" → {themeColor, collectorNumber, imageUri}

### Rate Limiting
- **RateLimiter class**: Enforces 100ms delay between Scryfall requests
- Required by Scryfall API terms

### Image Processing Pipeline
1. Download from Scryfall (672×936px)
2. `overlayBlackOnOriginalBorder()`: 28px black on edges via ImageMagick
3. `addBlackBorder()`: Add 33px bleed border (final: 738×1002px)

### Template System
- **CARD_TEMPLATE**: Embedded Card Conjurer format (lines 34-113)
- Color frames mapped from COLOR_TO_FRAME_MAP: {W/U/B/R/G/C/multicolor}
- Deep clone pattern: `JSON.parse(JSON.stringify(template))`

### Key Functions
| Function | Purpose |
|----------|---------|
| `queryCardData()` | Scryfall API query with caching |
| `queryPackCard()` | Find theme color from pack face card |
| `calculateWatermarkPosition()` | Fit watermark to bounds with zoom |
| `generateRulesText()` | Format card list by type (Creature, Instant, etc.) |
| `generatePackJSON()` | Create final Card Conjurer JSON |

## External Dependencies

### APIs
- **Scryfall API** (api.scryfall.com)
  - `/cards/named?exact={name}` - Get card data
  - `/cards/search?q=set:{code} {name}` - Find pack face cards
  - Rate limit: 100ms between requests (enforced by RateLimiter)

- **GitHub Raw** (raw.githubusercontent.com/pappnu/mtg-vectors)
  - Fetches SVG watermarks, converted to base64 data URIs

### Tools
- **ImageMagick**: CLI tool for image processing
  - Commands used: `magick identify`, `magick ... -fill ... -draw ...`
- **Playwright**: Browser automation for rendering card backs
  - Installed via npm as devDependency
  - Uses headless Chromium

## File Naming Conventions

**Output files follow this pattern:**
- JSON cards: `{SET}-{COLLECTOR_NUMBER}-{PACK_NAME}.json`
- Front images: `{SET}-front-{COLLECTOR_NUMBER}-{PACK_NAME}.jpg`
- Back images: `{SET}-back-{COLLECTOR_NUMBER}-{PACK_NAME}.jpg`
- Import file: `{SET}-saved-cards.cardconjurer`

**Examples:**
- `J22-front-0001-Blink-1.jpg` (front image)
- `J22-back-0001-Blink-1.jpg` (back image)

**Collector numbers:** `F 0001` format (F = Jumpstart Face card, 4 digits)

## Output Directory Structure

```
output/
├── json-decklists/            # Phase 1 output (~165KB)
│   └── {set-name}-output.json
├── cardconjurer-json-files/   # Individual cards (~6.2MB, 368 files)
│   └── {SET}-{NUM}-{PACK}.json
├── cardconjurer-import-files/ # Bulk import files (~6.2MB, 8 files)
│   └── {SET}-saved-cards.cardconjurer
├── front-images/              # Card fronts (~125MB, 368 files)
│   └── {SET}-front-{NUM}-{PACK}.jpg
└── back-images/               # Card backs (~125MB, 368 files)
    └── {SET}-back-{NUM}-{PACK}.jpg
```

**Total storage:** ~260MB for all generated files

## Image Processing Details

Face card images are automatically:

1. Downloaded from Scryfall (672×936 pixels)
2. Overlaid with 28px pure black on original borders
3. Extended with 33px black bleed borders (final: 738×1002 pixels)
4. Ready for makeplayingcards.com printing specifications

## Error Handling Patterns

The codebase uses these fallback strategies:
- **Card not found**: Uses card name with "Unknown" type, continues
- **Image unavailable**: Warns but continues
- **API errors**: Retries with rate limiting, uses cached data
- **SVG parsing failures**: Uses default positioning from template

Log levels: `[INFO]`, `[WARN]`, `[ERROR]`, `[FATAL]`

## Important Code Patterns

1. **Promise-based async operations** for I/O, API calls, image processing
2. **Regex parsing** for card quantities: `^(\d+)\s+(.+)$`
3. **Deep cloning** of template object for each card
4. **SVG dimension parsing** from base64-encoded data URIs
5. **Cross-platform CLI execution** with `execFileSync(..., {stdio: 'inherit'})`

## Performance Notes

- Sequential processing (not parallel) to respect Scryfall rate limits
- ~40-50 cards per set × 100ms = ~5-6 seconds API time + image downloads
- Render phase can run sets in parallel (controlled by environment variables)
- Each set uses multiple parallel browser pages during rendering

## Troubleshooting

### Common Issues

**ImageMagick not found:**
- Ensure ImageMagick is installed and `magick` command is in PATH
- Windows: Add ImageMagick install directory to system PATH

**Scryfall API errors:**
- Rate limiting is built-in, but network issues may cause temporary failures
- The script will retry with exponential backoff

**Playwright browser issues:**
- Run `npx playwright install chromium` after npm install
- Ensure sufficient disk space for browser download

**Memory issues during rendering:**
- Reduce `RENDER_PARALLEL` and `RENDER_PAGES` environment variables
- Close other applications to free memory

### Development Tips

- Use `npm run build` for faster iteration (skips rendering)
- Individual set processing for testing: `node generate-card-conjurer-json.js J22`
- Check logs for detailed error information
- Generated files persist between runs for caching

## Project Structure

```
├── txt-from-wotc/                 # WOTC text files by set
├── output/                        # Generated files (gitignored)
├── sets.json                      # Set configuration
├── convert-wotc-txt-to-json.js    # Phase 1: Parse text files
├── generate-card-conjurer-json.js # Phase 2: Generate cards/images  
├── render-card-backs.js           # Phase 3: Browser rendering
├── run-convert-all.js             # Helper: convert all sets
├── run-generate-all.js            # Helper: generate all sets
└── package.json                   # Dependencies and scripts
```