/**
 * @fileoverview Main Express application entry point for the Job Bid Visualizer middleware.
 */

import cors from 'cors';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MockAuthAdapter } from './core/adapters/auth.adapter';
import { VisualizationAdapter } from './core/adapters/visualization.adapter';
import { csvIngestMiddleware } from './middlewares/csv-ingest.middleware';

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

app.use(cors());
app.use(express.json());

const authAdapter = new MockAuthAdapter();
const vizAdapter = new VisualizationAdapter();

/**
 * Attaches a unique request ID to incoming headers and logs basic access info.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = crypto.randomUUID();
  console.log(`[${req.headers['x-request-id']}] ${req.method} ${req.path}`);
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
 * Primary ingestion endpoint for processing ERP CSV bid exports into dashboard payloads.
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

app.listen(port, () => {
  console.log(`[Job Bid Visualizer] Middleware running on port ${port}`);
  console.log(`Ready to receive ERP snapshots at POST /api/v1/visualizer/snapshot`);
});
