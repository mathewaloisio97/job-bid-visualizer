/**
 * @fileoverview Adapter for transforming bid records into structured dashboard payload data.
 */

import { BidRecord } from '../schemas/bid-record.schema';

/**
 * Transforms raw bid data into dashboard-ready portfolio hierarchies.
 */
export class VisualizationAdapter {
  /**
   * Transforms flat CSV records into a nested JSON hierarchy optimized for UI dashboards.
   * Computes real-time comparison metrics (lowest cost, soonest start, fastest duration) per job.
   *
   * @param records - List of parsed and validated bid records.
   * @returns Array of project portfolios containing nested job and bid analytics.
   */
  buildPortfolioDashboard(records: BidRecord[]) {
    const portfolio: Record<string, any> = {};

    for (const record of records) {
      if (!portfolio[record.projectId]) {
        portfolio[record.projectId] = {
          projectId: record.projectId,
          jobs: {},
        };
      }

      const project = portfolio[record.projectId];

      if (!project.jobs[record.jobId]) {
        project.jobs[record.jobId] = {
          jobId: record.jobId,
          jobName: record.jobName,
          bids: [],
          metrics: {
            lowestCost: Infinity,
            soonestStart: '9999-12-31',
            fastestDuration: Infinity,
          },
        };
      }

      const job = project.jobs[record.jobId];
      job.bids.push(record);

      // Update real-time comparison metrics.
      if (record.costEstimate < job.metrics.lowestCost) {
        job.metrics.lowestCost = record.costEstimate;
      }
      if (record.earliestStartDate < job.metrics.soonestStart) {
        job.metrics.soonestStart = record.earliestStartDate;
      }
      if (record.timeEstimateDays < job.metrics.fastestDuration) {
        job.metrics.fastestDuration = record.timeEstimateDays;
      }
    }

    // Format for JSON array output.
    return Object.values(portfolio).map((proj: any) => ({
      ...proj,
      jobs: Object.values(proj.jobs),
    }));
  }
}
