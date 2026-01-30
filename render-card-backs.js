const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CARDCONJURER_URL = 'https://cardconjurer.app';
const RENDER_WAIT_MS = 2000;
const MAX_RETRIES = 3;
const OUTPUT_DIR = path.join(__dirname, 'output', 'back-images');

/**
 * Parse the .cardconjurer file to build a mapping from card key to collector number
 * The infoNumber field contains values like "F 0001"
 */
function parseCardconjurerFile(filepath) {
  const mapping = {};

  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const cards = JSON.parse(content);

    for (const card of cards) {
      const key = card.key;
      const infoNumber = card.data?.infoNumber;

      if (key && infoNumber) {
        // Extract numeric part from "F 0001" -> "0001"
        const match = infoNumber.match(/(\d+)/);
        if (match) {
          mapping[key] = match[1];
        }
      }
    }
  } catch (error) {
    console.log(`[WARN] Failed to parse cardconjurer file: ${error.message}`);
  }

  return mapping;
}

/**
 * Generate filename for back image
 * Pattern: {SET}-back-{COLLECTOR_NUMBER}-{PACK_NAME}.jpg
 */
function generateFilename(setCode, cardName, collectorMapping) {
  // Get collector number from mapping
  const collectorNumber = collectorMapping[cardName] || '0000';

  // Convert card name to filename format: "Blink (1)" -> "Blink-1"
  const packNamePart = cardName
    .replace(/\s*\((\d+)\)$/, '-$1')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');

  return `${setCode}-back-${collectorNumber}-${packNamePart}.jpg`;
}

/**
 * Wait for network to be idle and additional render time
 */
async function waitForRender(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(RENDER_WAIT_MS);
}

/**
 * Navigate to Import/Save tab
 */
async function navigateToImportTab(page) {
  // Try multiple selectors for the Import/Save tab
  const tabSelectors = [
    'div#creator-menu-tabs h3:has-text("Import/Save")',
    'h3:has-text("Import/Save")',
    'h3:has-text("Import")'
  ];

  for (const selector of tabSelectors) {
    const tab = page.locator(selector);
    const count = await tab.count();
    if (count > 0) {
      await tab.first().click();
      await page.waitForTimeout(1000);
      return;
    }
  }

  console.log('[WARN] Could not find Import/Save tab, continuing anyway...');
}

/**
 * Upload a .cardconjurer file
 */
async function uploadFile(page, filepath) {
  console.log(`[INFO] Uploading file: ${path.basename(filepath)}`);

  // Navigate to Import/Save tab
  await navigateToImportTab(page);

  // Find the file input in the Import/Save section (accepts .cardconjurer files)
  const importSection = page.locator('#creator-menu-import');
  let targetInput;

  if (await importSection.count() > 0) {
    targetInput = importSection.locator('input[type="file"]').first();
  } else {
    // Fallback to first file input that accepts .cardconjurer
    targetInput = page.locator('input[type="file"][accept*=".cardconjurer"]').first();
  }

  await targetInput.setInputFiles(filepath);

  // Wait for the file to be processed
  await page.waitForTimeout(3000);

  // Verify cards were loaded
  const dropdown = page.locator('#load-card-options');
  const optionCount = await dropdown.locator('option').count();

  if (optionCount <= 1) {
    throw new Error('No cards loaded from file - check if file format is correct');
  }

  console.log(`[INFO] Loaded ${optionCount - 1} cards from file`);
}

/**
 * Get list of all saved cards from the dropdown
 */
async function getCardList(page) {
  const dropdown = page.locator('#load-card-options');
  const options = await dropdown.locator('option').all();
  const cards = [];

  // CardConjurer uses option index for selection (all values are "null")
  for (let i = 0; i < options.length; i++) {
    const text = await options[i].textContent();

    // Skip "None selected" placeholder (index 0)
    if (text && text.trim() !== '' && text.trim() !== 'None selected') {
      cards.push({
        index: i,
        name: text.trim()
      });
    }
  }

  console.log(`[INFO] Found ${cards.length} cards to render`);
  return cards;
}

/**
 * Select a card from the dropdown by index and wait for it to render
 */
async function selectCard(page, cardIndex) {
  // Navigate to Import/Save tab first (in case we're on a different tab)
  await navigateToImportTab(page);

  const dropdown = page.locator('#load-card-options');
  await dropdown.selectOption({ index: cardIndex });
  await waitForRender(page);
}

/**
 * Reset the watermark before downloading
 */
async function resetWatermark(page) {
  // Click the Watermark tab
  const watermarkTab = page.locator('h3').filter({ hasText: 'Watermark' });
  await watermarkTab.click();
  await page.waitForTimeout(500);

  // Click Reset Watermark button
  const resetButton = page.locator('button').filter({ hasText: 'Reset Watermark' });
  await resetButton.click();
  await page.waitForTimeout(500);
}

/**
 * Download the currently displayed card
 */
async function downloadCard(page, context, outputPath) {
  // Reset watermark before downloading
  await resetWatermark(page);

  // Find and click the download button
  const downloadButton = page.locator('h3.download').filter({ hasText: 'Download your card' });

  // Set up download listener
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await downloadButton.click();

  const download = await downloadPromise;
  await download.saveAs(outputPath);

  return true;
}

/**
 * Process a single card with retry logic
 */
async function processCard(page, context, card, setCode, outputDir, index, total, collectorMapping) {
  const filename = generateFilename(setCode, card.name, collectorMapping);
  const outputPath = path.join(outputDir, filename);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    console.log(`[INFO] [${index + 1}/${total}] Skipping ${card.name} (already exists)`);
    return { success: true, skipped: true };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[INFO] [${index + 1}/${total}] Processing: ${card.name}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);

      await selectCard(page, card.index);
      await downloadCard(page, context, outputPath);

      console.log(`[INFO] [${index + 1}/${total}] Downloaded: ${filename}`);
      return { success: true, skipped: false };
    } catch (error) {
      console.error(`[WARN] [${index + 1}/${total}] Attempt ${attempt} failed for ${card.name}: ${error.message}`);

      if (attempt === MAX_RETRIES) {
        // Take screenshot for debugging
        const screenshotPath = path.join(outputDir, `error-${setCode}-${index}.png`);
        try {
          await page.screenshot({ path: screenshotPath });
          console.error(`[ERROR] Screenshot saved to: ${screenshotPath}`);
        } catch (screenshotError) {
          console.error(`[ERROR] Failed to save screenshot: ${screenshotError.message}`);
        }

        return { success: false, error: error.message };
      }

      // Wait before retry
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * Main function to render all cards for a set
 */
async function renderSet(setCode) {
  const importFilePath = path.join(
    __dirname,
    'output',
    'cardconjurer-import-files',
    `${setCode}-saved-cards.cardconjurer`
  );

  // Validate input file exists
  if (!fs.existsSync(importFilePath)) {
    console.error(`[FATAL] Import file not found: ${importFilePath}`);
    console.error('[FATAL] Run "npm run build" first to generate the .cardconjurer files');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[INFO] Starting render for set: ${setCode}`);
  console.log(`[INFO] Import file: ${importFilePath}`);
  console.log(`[INFO] Output directory: ${OUTPUT_DIR}`);

  // Launch browser (headless for CI, can set to false for local debugging)
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    acceptDownloads: true
  });

  const page = await context.newPage();

  try {
    // Navigate to CardConjurer
    console.log(`[INFO] Navigating to ${CARDCONJURER_URL}`);
    await page.goto(CARDCONJURER_URL, { waitUntil: 'networkidle' });

    // Upload the .cardconjurer file
    await uploadFile(page, importFilePath);

    // Get list of all cards
    const cards = await getCardList(page);

    if (cards.length === 0) {
      console.error('[ERROR] No cards found in the import file');
      await browser.close();
      process.exit(1);
    }

    // Parse cardconjurer file to get collector numbers
    const collectorMapping = parseCardconjurerFile(importFilePath);

    // Process each card
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < cards.length; i++) {
      const result = await processCard(page, context, cards[i], setCode, OUTPUT_DIR, i, cards.length, collectorMapping);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.success++;
        }
      } else {
        results.failed++;
        results.errors.push({ card: cards[i].name, error: result.error });
      }
    }

    // Summary
    console.log('\n[INFO] ========== Render Summary ==========');
    console.log(`[INFO] Set: ${setCode}`);
    console.log(`[INFO] Total cards: ${cards.length}`);
    console.log(`[INFO] Downloaded: ${results.success}`);
    console.log(`[INFO] Skipped (existing): ${results.skipped}`);
    console.log(`[INFO] Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n[ERROR] Failed cards:');
      for (const err of results.errors) {
        console.log(`[ERROR]   - ${err.card}: ${err.error}`);
      }
    }

    await browser.close();

    if (results.failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(`[FATAL] Error during rendering: ${error.message}`);
    await browser.close();
    process.exit(1);
  }
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node render-card-backs.js <SET_CODE>');
  console.error('Example: node render-card-backs.js J22');
  process.exit(1);
}

const setCode = args[0].toUpperCase();
renderSet(setCode);
