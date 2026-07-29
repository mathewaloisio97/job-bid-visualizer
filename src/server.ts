/**
 * @fileoverview Main Express application entry point for the Job Bid Visualizer middleware.
 * Configures application routes, static asset serving, and state handling.
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

// Serve static frontend files from root public directory
app.use(express.static(path.join(process.cwd(), 'public')));

const authAdapter = new MockAuthAdapter();
const vizAdapter = new VisualizationAdapter();

/**
 * In-Memory state store for the stateless demo flow.
 * Stores the most recently ingested dashboard payload.
 */
let latestDashboardState: unknown = null;

/**
 * Express middleware that attaches a unique request ID to `/api` route headers
 * and logs basic access information.
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
 * Primary real-time ingestion endpoint for processing ERP CSV bid exports into dashboard payloads.
 * Caches the generated state in memory upon completion.
 */
app.post(
  '/api/v1/visualizer/snapshot',
  requireAuth,
  upload.single('file'),
  csvIngestMiddleware,
  (req: Request, res: Response) => {
    const { records, ingestErrors } = req.body;

    // Transform flat validated records into UI-ready metrics hierarchy.
    const portfolioDashboard = vizAdapter.buildPortfolioDashboard(records);

    // Store latest snapshot in memory for the frontend to consume
    latestDashboardState = portfolioDashboard;

    res.json({
      message: 'Dashboard data successfully refreshed.',
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
 * GET /api/v1/visualizer/data
 *
 * Frontend retrieval endpoint for fetching the currently cached dashboard state.
 */
app.get('/api/v1/visualizer/data', (req: Request, res: Response) => {
  if (!latestDashboardState) {
    return res
      .status(404)
      .json({ error: 'No snapshot data available. Please push ERP data first.' });
  }
  res.json(latestDashboardState);
});

app.listen(port, () => {
  console.log(`[Job Bid Visualizer] Server running on http://localhost:${port}`);
  console.log(`1. Push ERP data: npm run test:snapshot`);
  console.log(`2. View Dashboard: http://localhost:${port}`);
});
