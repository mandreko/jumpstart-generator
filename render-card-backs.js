const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CARDCONJURER_URL = 'https://cardconjurer.app';
const RENDER_WAIT_MS = 1000; // Wait for card to render after selection
const MAX_RETRIES = 3;
const OUTPUT_DIR = path.join(__dirname, 'output', 'back-images');
const PARALLEL_PAGES = parseInt(process.env.RENDER_PAGES, 10) || 4; // Parallel pages per browser

/**
 * Parse the .cardconjurer file to build a mapping from card key to collector number
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
 */
function generateFilename(setCode, cardName, collectorMapping) {
  const collectorNumber = collectorMapping[cardName] || '0000';
  const packNamePart = cardName
    .replace(/\s*\((\d+)\)$/, '-$1')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');

  return `${setCode}-back-${collectorNumber}-${packNamePart}.jpg`;
}

/**
 * Navigate to Import/Save tab
 */
async function navigateToImportTab(page) {
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
      await page.waitForTimeout(500);
      return;
    }
  }
}

/**
 * Upload a .cardconjurer file and wait for cards to load
 */
async function uploadFile(page, filepath) {
  await navigateToImportTab(page);

  const importSection = page.locator('#creator-menu-import');
  let targetInput;

  if (await importSection.count() > 0) {
    targetInput = importSection.locator('input[type="file"]').first();
  } else {
    targetInput = page.locator('input[type="file"][accept*=".cardconjurer"]').first();
  }

  await targetInput.setInputFiles(filepath);

  // Poll for cards to load
  const dropdown = page.locator('#load-card-options');
  let optionCount = 0;
  const maxWait = 10000;
  const pollInterval = 200;
  let waited = 0;

  while (waited < maxWait) {
    optionCount = await dropdown.locator('option').count();
    if (optionCount > 1) break;
    await page.waitForTimeout(pollInterval);
    waited += pollInterval;
  }

  if (optionCount <= 1) {
    throw new Error('No cards loaded from file');
  }

  return optionCount - 1;
}

/**
 * Wait for saved cards to be available (for secondary pages)
 */
async function waitForSavedCards(page) {
  await navigateToImportTab(page);

  const dropdown = page.locator('#load-card-options');
  let optionCount = 0;
  const maxWait = 10000;
  const pollInterval = 200;
  let waited = 0;

  while (waited < maxWait) {
    optionCount = await dropdown.locator('option').count();
    if (optionCount > 1) break;
    await page.waitForTimeout(pollInterval);
    waited += pollInterval;
  }

  return optionCount - 1;
}

/**
 * Get list of all saved cards from the dropdown
 */
async function getCardList(page) {
  const dropdown = page.locator('#load-card-options');
  const options = await dropdown.locator('option').all();
  const cards = [];

  for (let i = 0; i < options.length; i++) {
    const text = await options[i].textContent();
    if (text && text.trim() !== '' && text.trim() !== 'None selected') {
      cards.push({
        index: i,
        name: text.trim()
      });
    }
  }

  return cards;
}

/**
 * Process a single card
 */
async function processCard(page, card, setCode, outputDir, collectorMapping, workerId) {
  const filename = generateFilename(setCode, card.name, collectorMapping);
  const outputPath = path.join(outputDir, filename);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    return { success: true, skipped: true, card: card.name };
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Select card
      const dropdown = page.locator('#load-card-options');
      await dropdown.selectOption({ index: card.index });
      await page.waitForTimeout(RENDER_WAIT_MS);

      // Reset watermark
      await page.evaluate(() => resetWatermark());

      // Download
      const downloadButton = page.locator('h3.download').filter({ hasText: 'Download your card' });
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await downloadButton.click();

      const download = await downloadPromise;
      await download.saveAs(outputPath);

      return { success: true, skipped: false, card: card.name, filename };
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        return { success: false, card: card.name, error: error.message };
      }
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Worker function - processes cards from a shared queue
 */
async function cardWorker(page, cardQueue, setCode, outputDir, collectorMapping, workerId, results) {
  // WARM-UP HACK: Render a dummy card first to prime font loading
  try {
    console.log(`[W${workerId}] Warming up font rendering...`);

    // Select the last card in dropdown as dummy (less likely to be processed first)
    const dropdown = page.locator('#load-card-options');
    const optionCount = await dropdown.locator('option').count();

    if (optionCount > 1) {
      // Select last card and let it render to prime fonts
      await dropdown.selectOption({ index: optionCount - 1 });
      await page.waitForTimeout(RENDER_WAIT_MS);

      console.log(`[W${workerId}] Font warm-up complete`);
    }
  } catch (warmupError) {
    console.log(`[W${workerId}] Font warm-up failed: ${warmupError.message}`);
    // Continue anyway
  }

  // Process actual cards
  while (true) {
    const card = cardQueue.shift();
    if (!card) break;

    const result = await processCard(page, card, setCode, outputDir, collectorMapping, workerId);

    if (result.success) {
      if (result.skipped) {
        results.skipped++;
        console.log(`[W${workerId}] Skipped: ${result.card}`);
      } else {
        results.success++;
        console.log(`[W${workerId}] Downloaded: ${result.filename}`);
      }
    } else {
      results.failed++;
      results.errors.push({ card: result.card, error: result.error });
      console.error(`[W${workerId}] Failed: ${result.card} - ${result.error}`);
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

  if (!fs.existsSync(importFilePath)) {
    console.error(`[FATAL] Import file not found: ${importFilePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`[INFO] Starting render for set: ${setCode}`);
  console.log(`[INFO] Using ${PARALLEL_PAGES} parallel pages`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });

  try {
    // Create first page and upload file
    console.log(`[INFO] Uploading file...`);
    const primaryPage = await context.newPage();
    await primaryPage.goto(CARDCONJURER_URL, { waitUntil: 'networkidle' });
    const cardCount = await uploadFile(primaryPage, importFilePath);
    console.log(`[INFO] Loaded ${cardCount} cards`);

    // Reload page to fix font rendering issues (as suggested by user testing)
    console.log(`[INFO] Reloading page to ensure proper font rendering...`);
    await primaryPage.reload({ waitUntil: 'networkidle' });

    // Navigate back to Import/Save tab after reload
    await navigateToImportTab(primaryPage);

    // Wait a bit for everything to stabilize after reload
    await primaryPage.waitForTimeout(1000);

    // Get card list
    const cards = await getCardList(primaryPage);
    if (cards.length === 0) {
      throw new Error('No cards found');
    }

    // Parse collector numbers
    const collectorMapping = parseCardconjurerFile(importFilePath);

    // Create card queue (shared array that workers pull from)
    const cardQueue = [...cards];

    // Results tracking
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    // Determine number of workers (don't create more than cards)
    const numWorkers = Math.min(PARALLEL_PAGES, cards.length);
    console.log(`[INFO] Processing ${cards.length} cards with ${numWorkers} workers`);

    // Create additional pages
    const pages = [primaryPage];
    for (let i = 1; i < numWorkers; i++) {
      const page = await context.newPage();
      await page.goto(CARDCONJURER_URL, { waitUntil: 'networkidle' });
      await waitForSavedCards(page);

      // Also reload secondary pages to ensure proper font rendering
      console.log(`[INFO] Reloading secondary page ${i + 1} for font rendering...`);
      await page.reload({ waitUntil: 'networkidle' });
      await navigateToImportTab(page);
      await page.waitForTimeout(500);

      pages.push(page);
    }

    // Start workers
    const startTime = Date.now();
    const workers = pages.map((page, i) =>
      cardWorker(page, cardQueue, setCode, OUTPUT_DIR, collectorMapping, i + 1, results)
    );

    await Promise.all(workers);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Summary
    console.log('\n[INFO] ========== Render Summary ==========');
    console.log(`[INFO] Set: ${setCode}`);
    console.log(`[INFO] Total cards: ${cards.length}`);
    console.log(`[INFO] Downloaded: ${results.success}`);
    console.log(`[INFO] Skipped: ${results.skipped}`);
    console.log(`[INFO] Failed: ${results.failed}`);
    console.log(`[INFO] Time: ${duration}s`);

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
    console.error(`[FATAL] Error: ${error.message}`);
    await browser.close();
    process.exit(1);
  }
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node render-card-backs.js <SET_CODE>');
  console.error('Example: node render-card-backs.js J22');
  console.error('Set RENDER_PAGES env var to control parallel pages (default: 4)');
  process.exit(1);
}

const setCode = args[0].toUpperCase();
renderSet(setCode);
