import cors from 'cors';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint to verify the server is running.
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Job Bid Visualizer middleware is running.',
  });
});

app.listen(port, () => {
  console.log(`[Job Bid Visualizer] Initialized and running on port ${port}`);
});
