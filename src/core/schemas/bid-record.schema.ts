/**
 * @fileoverview Bid record parsing and transformation schema.
 *
 * Sanitizes incoming raw CSV row objects into validated, typed Bid records.
 * Handles currency normalization, numeric coercions, and finish-date estimation.
 */

import { z } from 'zod';

/**
 * Validates and transforms raw CSV row input into a normalized `BidRecord`.
 *
 * ### Key Transformations:
 * - **`costEstimate`**: Strips currency symbols/commas and parses float. Defaults unparseable strings to `0`.
 * - **`timeEstimateDays`**: Coerces string representation to base-10 integer.
 * - **`status`**: Normalizes to lower-case.
 * - **`estimatedFinishDate`**: Calculates ISO date string (`YYYY-MM-DD`) by adding
 *   `timeEstimateDays` to `earliestStartDate`.
 */
export const BidRecordSchema = z
  .object({
    projectId: z.string().trim().min(1, 'Project ID is required'),
    jobId: z.string().trim().min(1, 'Job ID is required'),
    jobName: z.string().trim().min(1, 'Job Name is required'),
    bidId: z.string().trim().min(1, 'Bid ID is required'),
    vendorName: z.string().trim().min(1, 'Vendor Name is required'),

    costEstimate: z.string().transform((val) => {
      const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }),

    earliestStartDate: z
      .string()
      .trim()
      .pipe(
        z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: 'Invalid ISO start date string',
        })
      ),

    timeEstimateDays: z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : parsed;
    }),

    status: z.string().trim().toLowerCase(),
  })
  .transform((data) => {
    // Parse using UTC to avoid timezone shifts across daylight savings boundaries.
    const startDate = new Date(data.earliestStartDate);
    const finishDate = new Date(startDate);
    finishDate.setUTCDate(startDate.getUTCDate() + data.timeEstimateDays);

    return {
      ...data,
      estimatedFinishDate: finishDate.toISOString().split('T')[0],
    };
  });

/**
 * Parsed and calculated Bid record shape.
 */
export type BidRecord = z.infer<typeof BidRecordSchema>;
