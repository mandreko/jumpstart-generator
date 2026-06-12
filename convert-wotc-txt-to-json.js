const fs = require("fs").promises;
const path = require("path");

async function ensureOutputDirs() {
  const outDir = path.join(__dirname, "output");
  const jsonDecklistsDir = path.join(outDir, "json-decklists");

  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.mkdir(jsonDecklistsDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create required output directories:", err);
    process.exit(1);
  }
}

function parseCardList(fileContent, folderName = "") {
  const lines = fileContent.split("\n");
  const cardMap = new Map();
  const isAvatarFolder = folderName.toLowerCase() === "avatar";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let cardLine = trimmed.replace(/\[.*?\]/g, "").trim();

    if (!cardLine) continue;

    const match = cardLine.match(/^(\d+)\s+(.+)$/);

    if (match) {
      const count = parseInt(match[1], 10);
      let cardName = match[2].trim();

      if (isAvatarFolder && cardName.toLowerCase().includes("appa")) {
        cardName = cardName.replace(/\s+Appa/gi, "").trim();
      }

      if (cardMap.has(cardName)) {
        cardMap.set(cardName, cardMap.get(cardName) + count);
      } else {
        cardMap.set(cardName, count);
      }
    } else {
      let cardName = cardLine;

      if (isAvatarFolder && cardName.toLowerCase().includes("appa")) {
        cardName = cardName.replace(/\s+Appa/gi, "").trim();
      }

      if (cardMap.has(cardName)) {
        cardMap.set(cardName, cardMap.get(cardName) + 1);
      } else {
        cardMap.set(cardName, 1);
      }
    }
  }

  const cards = [];
  for (const [cardName, count] of cardMap) {
    if (count > 1) {
      cards.push(`${count} ${cardName}`);
    } else {
      cards.push(cardName);
    }
  }

  return cards;
}

async function processFolder(folderName) {
  const folderPath = path.join("txt-from-wotc", folderName);
  const files = await fs.readdir(folderPath);

  const txtFiles = files.filter((f) => f.endsWith(".txt")).sort();

  const results = [];

  for (const file of txtFiles) {
    console.log(`Processing ${file}...`);

    const filePath = path.join(folderPath, file);
    const content = await fs.readFile(filePath, "utf-8");

    const name = file.replace(".txt", "").replace(/\s+/g, " ").trim();
    const cards = parseCardList(content, folderName);

    results.push({
      name,
      cards,
    });
  }

  await ensureOutputDirs();

  const outputFilename = folderName.toLowerCase().replace(/[:\s]+/g, "-");
  const outputPath = path.join(
    "output",
    "json-decklists",
    `${outputFilename}-output.json`
  );
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));

  console.log(`\nProcessed ${results.length} packs`);
  console.log(`Output written to ${outputPath}`);
}

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error("Usage: node parse-jumpstart.js <folder-name>");
  console.error('Example: node parse-jumpstart.js "Avatar"');
  console.error('Example: node parse-jumpstart.js "Foundations"');
  process.exit(1);
}

const [folderName] = args;

processFolder(folderName).catch(console.error);
