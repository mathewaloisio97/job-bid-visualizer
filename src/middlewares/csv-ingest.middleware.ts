/**
 * @fileoverview Express middleware for streaming and validating CSV bid payloads.
 */

import csv from 'csv-parser';
import { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';
import { BidRecord, BidRecordSchema } from '../core/schemas/bid-record.schema';

/**
 * Parses uploaded CSV file streams and validates each row against the bid record schema.
 *
 * Attaches structured results (`records`) and row-level errors (`ingestErrors`) to `req.body`.
 *
 * @param req - Express request object containing the uploaded file buffer under `req.file`.
 * @param res - Express response object.
 * @param next - Express next function to pass execution to the next middleware.
 */
export const csvIngestMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No CSV file uploaded in form-data field "file"' });
  }

  const results: BidRecord[] = [];
  const errors: any[] = [];
  let rowNumber = 1;

  const stream = Readable.from(req.file.buffer);

  stream
    .pipe(csv())
    .on('data', (data) => {
      rowNumber++;
      const validation = BidRecordSchema.safeParse(data);

      if (validation.success) {
        results.push(validation.data);
      } else {
        errors.push({
          row: rowNumber,
          issues: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
          raw: data,
        });
      }
    })
    .on('end', () => {
      req.body.records = results;
      req.body.ingestErrors = errors;
      next();
    })
    .on('error', (err) => {
      res.status(500).json({ error: 'Failed to parse CSV stream', details: err.message });
    });
};
