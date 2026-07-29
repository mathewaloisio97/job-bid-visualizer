import fs from 'fs';
import path from 'path';

const filePath = path.resolve('./data/sample-bids.csv');

async function uploadData() {
  const fileContent = fs.readFileSync(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileContent]), 'sample-bids.csv');

  try {
    const response = await fetch('http://localhost:3000/api/v1/visualizer/push', {
      method: 'POST',
      headers: { Authorization: 'Bearer middleware-secure-token' },
      body: formData,
    });

    const json = await response.json();
    console.log(`[Push] Response [${response.status}]:`, json.message);

    // Log explicit warnings if Zod rejected any rows due to typos.
    if (json.meta && json.meta.failedRows > 0) {
      console.warn(`[Warning] ${json.meta.failedRows} rows failed validation and were skipped.`);
      console.warn(JSON.stringify(json.ingestErrors, null, 2));
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

console.log(`Watching for changes on ${filePath}...`);
uploadData();

let debounceTimer;
fs.watch(filePath, (eventType) => {
  if (eventType === 'change') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) return; // Ignore empty file reads during atomic OS saves.

        console.log('\nDetected file change. Pushing updates...');
        await uploadData();
      } catch (e) {
        // Ignore file lock errors.
      }
    }, 500);
  }
});
