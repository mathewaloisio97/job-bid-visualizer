/**
 * @fileoverview Main Express application entry point for the Job Bid Visualizer middleware.
 * Handles ERP data ingestion, state management, static asset serving, and real-time Server-Sent Events (SSE) broadcasting.
 *
 * @module Server
 */

import cors from 'cors';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { MockAuthAdapter } from './core/adapters/auth.adapter';
import { VisualizationAdapter } from './core/adapters/visualization.adapter';
import { csvIngestMiddleware } from './middlewares/csv-ingest.middleware';

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

app.use(cors());
app.use(express.json());

// Serve static frontend assets from public root.
app.use(express.static(path.join(process.cwd(), 'public')));

const authAdapter = new MockAuthAdapter();
const vizAdapter = new VisualizationAdapter();

/**
 * In-Memory state store holding the most recent portfolio dashboard snapshot payload.
 */
let latestDashboardState: unknown = null;

/**
 * Registry of active Server-Sent Events (SSE) client response channels for real-time broadcasts.
 */
let sseClients: Response[] = [];

/**
 * Express middleware attaching a unique request ID header (`x-request-id`)
 * and logging API route access details.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    req.headers['x-request-id'] = crypto.randomUUID();
    console.log(`[${req.headers['x-request-id']}] ${req.method} ${req.path}`);
  }
  next();
});

/**
 * Express middleware enforcing authentication via the configured AuthAdapter.
 */
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const user = await authAdapter.authenticate(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }
  next();
};

/**
 * POST /api/v1/visualizer/snapshot
 *
 * Ingestion endpoint for ERP CSV bid uploads. Processes records, refreshes global in-memory state,
 * and immediately broadcasts updated dashboards to all connected SSE clients.
 */
app.post(
  '/api/v1/visualizer/snapshot',
  requireAuth,
  upload.single('file'),
  csvIngestMiddleware,
  (req: Request, res: Response) => {
    const { records, ingestErrors } = req.body;
    const portfolioDashboard = vizAdapter.buildPortfolioDashboard(records);

    latestDashboardState = portfolioDashboard;

    // Broadcast updated payload to all active SSE subscribers instantly.
    const payload = `data: ${JSON.stringify(portfolioDashboard)}\n\n`;
    sseClients.forEach((client) => client.write(payload));

    res.json({
      message: 'Dashboard data successfully refreshed and broadcasted to clients.',
      meta: {
        requestId: req.headers['x-request-id'],
        totalValidBids: records.length,
        failedRows: ingestErrors.length,
      },
      dashboard: portfolioDashboard,
      ingestErrors: ingestErrors.length > 0 ? ingestErrors : undefined,
    });
  }
);

/**
 * GET /api/v1/visualizer/stream
 *
 * Real-time Server-Sent Events (SSE) streaming endpoint.
 * Immediately pushes cached state upon connection and registers client channels for future updates.
 */
app.get('/api/v1/visualizer/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');

  // Instantly establish the connection stream.
  res.flushHeaders();

  // Push existing state immediately on initial client handshake if available.
  if (latestDashboardState) {
    res.write(`data: ${JSON.stringify(latestDashboardState)}\n\n`);
  }

  sseClients.push(res);

  // Clean up client reference on socket disconnect / browser tab closure.
  req.on('close', () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

app.listen(port, () => {
  console.log(`[Job Bid Visualizer] Server running on http://localhost:${port}`);
  console.log(`1. Push ERP data: npm run test:snapshot`);
  console.log(`2. View Dashboard: http://localhost:${port}`);
});
