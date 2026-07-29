import { readFileSync } from 'fs';

async function testSnapshot() {
  const filePath = './data/sample-bids.csv';
  const fileContent = readFileSync(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileContent]), 'sample-bids.csv');

  try {
    const response = await fetch('http://localhost:3000/api/v1/visualizer/snapshot', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer middleware-secure-token',
      },
      body: formData,
    });

    const status = response.status;
    const data = await response.text();

    console.log(`Response [${status}]:`, data);
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testSnapshot();
