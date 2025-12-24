const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Read sets.json
const setsJsonPath = path.join(__dirname, 'sets.json');

try {
  const setsContent = fs.readFileSync(setsJsonPath, 'utf-8');
  const setsConfig = JSON.parse(setsContent);

  // Extract unique set codes
  const setCodes = [...new Set(setsConfig.map(s => s.set))];

  console.log(`Found ${setCodes.length} sets to process: ${setCodes.join(', ')}\n`);

  for (const setCode of setCodes) {
    console.log(`\nProcessing set: ${setCode}`);
    try {
      execFileSync('node', ['generate-card-conjurer-json.js', setCode], {
        stdio: 'inherit',
        cwd: __dirname
      });
    } catch (error) {
      console.error(`Failed to process ${setCode}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\nAll sets generated successfully!');
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
