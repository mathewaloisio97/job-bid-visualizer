/**
 * @fileoverview Main Express application entry point for the Job Bid Visualizer middleware.
 * Handles granular ERP data ingestion (snapshot, push, remove), state management, static asset serving,
 * and real-time Server-Sent Events (SSE) broadcasting.
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
import { BidRecord } from './core/schemas/bid-record.schema';
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
 * Granular In-Memory Map store keyed by compound composite keys (`projectId::jobId::bidId`).
 * Allows partial state updates (upserts and deletions) without clearing global state.
 */
const recordStore = new Map<string, BidRecord>();

/**
 * In-Memory state store holding the most recent portfolio dashboard snapshot payload.
 */
let latestDashboardState: unknown = null;

/**
 * Registry of active Server-Sent Events (SSE) client response channels for real-time broadcasts.
 */
let sseClients: Response[] = [];

/**
 * Generates a unique composite key for indexing bid records within the in-memory map store.
 *
 * @param projectId - Parent project identifier.
 * @param jobId - Parent job scope identifier.
 * @param bidId - Unique vendor proposal identifier.
 * @returns Formatted composite lookup key.
 */
const getRecordKey = (projectId: string, jobId: string, bidId: string): string =>
  `${projectId}::${jobId}::${bidId}`;

/**
 * Rebuilds the portfolio dashboard hierarchy from the current record store state,
 * updates the cached dashboard payload, and broadcasts the fresh payload to all connected SSE clients.
 *
 * @returns Rebuilt portfolio dashboard hierarchy structure.
 */
const broadcastUpdatedState = () => {
  const rawRecords = Array.from(recordStore.values());
  const portfolioDashboard = vizAdapter.buildPortfolioDashboard(rawRecords);
  latestDashboardState = portfolioDashboard;

  const payload = `data: ${JSON.stringify(portfolioDashboard)}\n\n`;
  sseClients.forEach((client) => client.write(payload));
  return portfolioDashboard;
};

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
 * Full truncation endpoint for ERP CSV bid uploads. Clears existing in-memory store,
 * populates fresh records, rebuilds hierarchy, and broadcasts updates to SSE subscribers.
 */
app.post(
  '/api/v1/visualizer/snapshot',
  requireAuth,
  upload.single('file'),
  csvIngestMiddleware,
  (req: Request, res: Response) => {
    const { records, ingestErrors } = req.body;

    recordStore.clear(); // Truncate existing state.
    records.forEach((r: BidRecord) =>
      recordStore.set(getRecordKey(r.projectId, r.jobId, r.bidId), r)
    );

    const dashboard = broadcastUpdatedState();
    res.json({
      message: 'Truncated and synced successfully.',
      meta: {
        requestId: req.headers['x-request-id'],
        totalValidBids: records.length,
        failedRows: ingestErrors.length,
      },
      dashboard,
      ingestErrors: ingestErrors.length > 0 ? ingestErrors : undefined,
    });
  }
);

/**
 * POST /api/v1/visualizer/push
 *
 * Granular ingestion endpoint for appends/upserts. Merges incoming CSV bid records
 * into the current map store, rebuilds hierarchy, and broadcasts updates to SSE subscribers.
 */
app.post(
  '/api/v1/visualizer/push',
  requireAuth,
  upload.single('file'),
  csvIngestMiddleware,
  (req: Request, res: Response) => {
    const { records, ingestErrors } = req.body;

    // Granular upsert into the active record map.
    records.forEach((r: BidRecord) =>
      recordStore.set(getRecordKey(r.projectId, r.jobId, r.bidId), r)
    );

    const dashboard = broadcastUpdatedState();
    res.json({
      message: 'Push appended and synced successfully.',
      meta: {
        requestId: req.headers['x-request-id'],
        totalValidBids: records.length,
        failedRows: ingestErrors.length,
      },
      dashboard,
      ingestErrors: ingestErrors.length > 0 ? ingestErrors : undefined,
    });
  }
);

/**
 * DELETE /api/v1/visualizer/remove/:projectId/:jobId/:bidId
 *
 * Removes a specific bid record from the map store by composite key, rebuilds hierarchy,
 * automatically prunes empty jobs/projects, and broadcasts updates to SSE subscribers.
 */
app.delete(
  '/api/v1/visualizer/remove/:projectId/:jobId/:bidId',
  requireAuth,
  (req: Request, res: Response) => {
    const { projectId, jobId, bidId } = req.params;
    const key = getRecordKey(projectId, jobId, bidId);

    if (!recordStore.has(key)) {
      return res.status(404).json({ error: `Record ${key} not found.` });
    }

    recordStore.delete(key);
    const dashboard = broadcastUpdatedState();
    res.json({ message: `Record ${bidId} removed successfully.`, dashboard });
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
