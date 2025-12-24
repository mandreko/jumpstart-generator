const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Get all directories in txt-from-wotc/
const libraryPath = path.join(__dirname, 'txt-from-wotc');

try {
  const entries = fs.readdirSync(libraryPath, { withFileTypes: true });
  const folders = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  console.log(`Found ${folders.length} folders to process\n`);

  for (const folder of folders) {
    console.log(`Processing: ${folder}`);
    try {
      execFileSync('node', ['convert-wotc-txt-to-json.js', folder], {
        stdio: 'inherit',
        cwd: __dirname
      });
    } catch (error) {
      console.error(`Failed to process ${folder}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\nAll conversions completed successfully!');
} catch (error) {
  console.error(`Error reading library directory: ${error.message}`);
  process.exit(1);
}
