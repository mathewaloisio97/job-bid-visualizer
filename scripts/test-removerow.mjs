import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('=== Job Bid Visualizer: Remove Row CLI ===');
console.log('Type: <projectId> <jobId> <bidId> and press Enter.');
console.log('Example: PRJ-401 JOB-102 BID-901\n');

rl.prompt();

rl.on('line', async (line) => {
  const args = line.trim().split(/\s+/);
  if (args.length !== 3) {
    console.log('Error: Invalid format. Please provide exactly 3 arguments.');
    rl.prompt();
    return;
  }

  const [projectId, jobId, bidId] = args;

  try {
    const url = `http://localhost:3000/api/v1/visualizer/remove/${encodeURIComponent(projectId)}/${encodeURIComponent(jobId)}/${encodeURIComponent(bidId)}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer middleware-secure-token' },
    });

    console.log(`Response [${response.status}]:`, await response.text());
  } catch (error) {
    console.error('Request failed:', error.message);
  }

  console.log('');
  rl.prompt();
});
