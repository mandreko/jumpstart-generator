# MTG Jumpstart Card Conjurer JSON Generator

Generates Card Conjurer JSON files for MTG Jumpstart packs by querying Scryfall API for card data. Also downloads and processes face card images with black borders for MPC printing.

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

### System Requirements

- Internet connection (for Scryfall API access)
- ~500MB free disk space for generated files
- Scryfall API rate limit: 100ms delay between requests (handled automatically)

### Platform Notes

All npm scripts are cross-platform compatible and work on Windows, macOS, and Linux without requiring any special shell environment.

## Usage

### Installation

First, install dependencies (required for cross-platform compatibility):

```bash
npm install
```

### Quick Start

Build everything from scratch:

```bash
npm run rebuild
```

### Individual Commands

**Convert WOTC text files to intermediate JSON:**

```bash
npm run convert
```

**Generate Card Conjurer JSON files from intermediate JSON:**

```bash
npm run generate
```

**Full build (convert + generate):**

```bash
npm run build
```

**Clean generated files:**

```bash
npm run clean
```

## Manual Usage

### Convert a specific set:

```bash
node convert-wotc-txt-to-json.js "Avatar"
```

### Generate Card Conjurer JSONs for a specific set:

```bash
node generate-card-conjurer-json.js TLA
```

Available set codes: `TLA`, `DMU`, `J25`, `J22`, `LTR`, `MOM`, `ONE`, `BRO`

## Output

Generated files are located in:

- `output/json-decklists/` - Intermediate JSON decklist files (e.g., `avatar-output.json`)
- `output/cardconjurer-json-files/` - Individual Card Conjurer JSON files for each pack
- `output/cardconjurer-import-files/` - Combined `.cardconjurer` files for bulk import into Card Conjurer
- `output/front-images/` - Face card images with black borders for MPC printing

### Image Processing

Face card images are automatically:

1. Downloaded from Scryfall (672×936 pixels)
2. Overlaid with 28px pure black on original borders
3. Extended with 33px black bleed borders (final: 738×1002 pixels)
4. Ready for makeplayingcards.com printing

## Project Structure

- `txt-from-wotc/` - WOTC text files organized by set
- `output/` - All generated output files (organized into subdirectories)
- `sets.json` - Set configuration (watermark URLs, set codes, etc.)
- `convert-wotc-txt-to-json.js` - Converts WOTC text files to intermediate JSON
- `generate-card-conjurer-json.js` - Generates Card Conjurer JSON files from intermediate JSON
- `run-convert-all.js` - Helper script to convert all sets (cross-platform)
- `run-generate-all.js` - Helper script to generate all sets (cross-platform)

## Thanks

This project was 100% coded by Claude AI as a test of vibe-coding capabilities

Additionally, these folks and projects made this project possible:

- [Scryfall](https://scryfall.com/) - for use of their amazing API
- https://github.com/pappnu/mtg-vectors - for use of the SVG vector files
- https://www.reddit.com/user/HyperHowie/ - for the idea and instructions on how to create cards like theirs
- [CardConjurer.app](https://cardconjurer.app/) - for use of their site and making it possible to import/export files
- Wizards of the Coasts - for putting their Jumpstart Pack Lists available on their site to download
