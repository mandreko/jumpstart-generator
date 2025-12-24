# Usage Guide

This guide walks you through the complete workflow for generating and printing custom Magic: The Gathering Jumpstart cards.

---

## Step 1: Import Text File Inventories to JSON Format

Starting with raw deck lists from Wizards of the Coast or other sources such as [mtg.wtf/deck](https://mtg.wtf/deck), you can parse them into a friendly JSON format.

### Single Set Conversion

```bash
node convert-wotc-txt-to-json.js
```

### Batch Conversion (All Sets)

```bash
node run-convert-all.js
```

This processes all sets defined in `sets.json`.

---

## Step 2: Convert JSON to CardConjurer Import Format

Transform your JSON deck files into a format that CardConjurer can import.

### Single Set

```bash
node generate-card-conjurer-json.js
```

### All Sets

```bash
node run-generate-all.js
```

This iterates over all JSON files from the previous step.

**Output Location:** `output/cardconjurer-import-files/`

---

## Step 3: Import into CardConjurer

1. **Visit** [CardConjurer](https://cardconjurer.app/)
2. **Navigate** to the **"Import/Save"** tab
3. **Clear existing cards:**
   - Check the "Load a saved card" dropdown
   - If cards are present, click **"Delete all"** to clear them
4. **Upload your file:**
   - Click **"Browse..."** under "Upload previously downloaded file of saved cards"
   - Select your generated file from `output/cardconjurer-import-files/`
5. **Verify cards:**
   - Select a card from the "Load a saved card" dropdown
   - Ensure it renders correctly
6. **Download:** Click the **"Download your card"** link for each card

> **Note:** Manually downloading each card can be tedious. See the next section for automation.

---

## Step 4: Automate Downloads with Greasemonkey (Optional)

To avoid manually downloading each card, use the provided Greasemonkey script.

### Installation

1. **Install a Greasemonkey extension** for your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (recommended, tested on Firefox)
   - Greasemonkey
   - Violentmonkey

2. **Install the script** from Greasy Fork:
   [Download All Cards on CardConjurer](https://greasyfork.org/en/scripts/560030-download-all-cards-on-cardconjurer)

### Usage

1. Reload [CardConjurer](https://cardconjurer.app)
2. Click the **"Download all"** button

The script will automatically iterate through and download all cards.

---

## Step 5: Print with MPC or NotMPC

Using your downloaded cards, you can now order professional prints.

### What You Need

- **Card Backs:** Downloaded images from CardConjurer
- **Card Fronts:** Images from `output/front-images/`

### Ordering

Visit [NotMPC](https://notmpc.com/custom-game-cards/) or similar services and use their **double-sided game cards** option to upload your fronts and backs.

---

## Quick Reference

| Step                            | Command                    | Output                              |
| ------------------------------- | -------------------------- | ----------------------------------- |
| 1. Parse text files             | `node run-convert-all.js`  | JSON files                          |
| 2. Generate CardConjurer format | `node run-generate-all.js` | `output/cardconjurer-import-files/` |
| 3. Import to CardConjurer       | Manual upload              | Rendered cards                      |
| 4. Download cards               | Greasemonkey script        | Card images                         |
| 5. Print cards                  | Upload to NotMPC           | Physical cards                      |
