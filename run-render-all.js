const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
// Default to all sets in parallel (set RENDER_PARALLEL to limit if needed)
const MAX_PARALLEL = parseInt(process.env.RENDER_PARALLEL, 10) || Infinity;

/**
 * Run render-card-backs.js for a single set
 * Returns a promise that resolves when the process completes
 */
function renderSet(setCode) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log(`[${setCode}] Starting render...`);

    const proc = spawn('node', ['render-card-backs.js', setCode], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (code === 0) {
        // Extract summary from stdout
        const lines = stdout.split('\n');
        const summaryStart = lines.findIndex(l => l.includes('Render Summary'));
        if (summaryStart !== -1) {
          const summaryLines = lines.slice(summaryStart + 1, summaryStart + 6);
          console.log(`[${setCode}] Completed in ${duration}s`);
          summaryLines.forEach(line => {
            if (line.trim()) console.log(`[${setCode}]   ${line.trim()}`);
          });
        } else {
          console.log(`[${setCode}] Completed in ${duration}s`);
        }
        resolve({ setCode, success: true, duration });
      } else {
        console.error(`[${setCode}] Failed (exit code ${code}) after ${duration}s`);
        if (stderr) {
          stderr.split('\n').slice(0, 5).forEach(line => {
            if (line.trim()) console.error(`[${setCode}]   ${line.trim()}`);
          });
        }
        resolve({ setCode, success: false, duration, error: stderr || `Exit code ${code}` });
      }
    });

    proc.on('error', (err) => {
      console.error(`[${setCode}] Failed to start: ${err.message}`);
      resolve({ setCode, success: false, error: err.message });
    });
  });
}

/**
 * Run renders in parallel with concurrency limit
 */
async function runParallel(setCodes, maxParallel) {
  const results = [];
  const pending = [...setCodes];

  async function worker() {
    while (pending.length > 0) {
      const setCode = pending.shift();
      if (setCode) {
        const result = await renderSet(setCode);
        results.push(result);
      }
    }
  }

  // Start workers up to maxParallel
  const workers = [];
  for (let i = 0; i < Math.min(maxParallel, setCodes.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

// Main
async function main() {
  const setsJsonPath = path.join(__dirname, 'sets.json');

  let setsConfig;
  try {
    const setsContent = fs.readFileSync(setsJsonPath, 'utf-8');
    setsConfig = JSON.parse(setsContent);
  } catch (error) {
    console.error(`Error reading sets.json: ${error.message}`);
    process.exit(1);
  }

  // Extract unique set codes
  const setCodes = [...new Set(setsConfig.map(s => s.set))];

  console.log(`Found ${setCodes.length} sets to render: ${setCodes.join(', ')}`);
  console.log(`Running up to ${MAX_PARALLEL} sets in parallel\n`);

  const startTime = Date.now();
  const results = await runParallel(setCodes, MAX_PARALLEL);
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('\n========== Final Summary ==========');
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total time: ${totalDuration}s`);
  console.log(`Succeeded: ${succeeded.length}/${setCodes.length}`);

  if (failed.length > 0) {
    console.log(`Failed: ${failed.map(r => r.setCode).join(', ')}`);
    process.exit(1);
  }

  console.log('\nAll sets rendered successfully!');
}

main();
