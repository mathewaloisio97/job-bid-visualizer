/**
 * @fileoverview Adapter for transforming bid records into structured dashboard payload data.
 * Aggregates raw bid data into project/job hierarchies, tracks metric-level vendor attribution,
 * counts accepted proposals, and computes filtered summary metrics.
 *
 * @module VisualizationAdapter
 */

import { BidRecord } from '../schemas/bid-record.schema';

/**
 * Metric object storing a calculated benchmark value paired with its originating vendor.
 */
export interface MetricDetail<T> {
  /** The calculated metric value (cost, start date, or duration in days). */
  value: T;

  /** Display name of the vendor who submitted the winning benchmark bid. */
  vendorName: string;
}

/**
 * Calculated aggregate metrics for a specific job scope.
 */
export interface JobMetrics {
  /** Lowest cost estimate submitted across active bids and its vendor, or null if unassigned. */
  lowestCost: MetricDetail<number> | null;

  /** Earliest start date among active bids and its vendor, or null if unassigned. */
  soonestStart: MetricDetail<string> | null;

  /** Shortest execution duration in days across active bids and its vendor, or null if unassigned. */
  fastestDuration: MetricDetail<number> | null;

  /** Total count of bids marked as "accepted" for this job. */
  acceptedCount: number;
}

/**
 * Intermediate internal structure for mapping job data before final portfolio serialization.
 */
interface InternalJob {
  jobId: string;
  jobName: string;
  bids: BidRecord[];
  metrics: JobMetrics;
}

/**
 * Intermediate internal structure for mapping project data before final portfolio serialization.
 */
interface InternalProject {
  projectId: string;
  jobs: Record<string, InternalJob>;
}

/**
 * Transforms raw bid data into dashboard-ready portfolio hierarchies.
 */
export class VisualizationAdapter {
  /**
   * Transforms flat CSV records into a nested JSON hierarchy optimized for UI dashboards.
   * Computes real-time comparison metrics (lowest cost, soonest start, fastest duration) per job,
   * tracks vendor attribution for top metrics, and filters out declined/revoked bids from summary benchmarks.
   *
   * @param records - List of parsed and validated bid records.
   * @returns Array of project portfolios containing nested job and bid analytics.
   */
  buildPortfolioDashboard(records: BidRecord[]) {
    const portfolio: Record<string, InternalProject> = {};

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
            lowestCost: null,
            soonestStart: null,
            fastestDuration: null,
            acceptedCount: 0,
          },
        };
      }

      const job = project.jobs[record.jobId];
      job.bids.push(record);

      const normalizedStatus = record.status.toLowerCase();

      // Track total accepted bids count.
      if (normalizedStatus === 'accepted') {
        job.metrics.acceptedCount++;
      }

      // Automatically ignore "declined" and "revoked" statuses for the top-level summary metrics.
      if (normalizedStatus !== 'declined' && normalizedStatus !== 'revoked') {
        if (!job.metrics.lowestCost || record.costEstimate < job.metrics.lowestCost.value) {
          job.metrics.lowestCost = {
            value: record.costEstimate,
            vendorName: record.vendorName,
          };
        }

        if (
          !job.metrics.soonestStart ||
          record.earliestStartDate < job.metrics.soonestStart.value
        ) {
          job.metrics.soonestStart = {
            value: record.earliestStartDate,
            vendorName: record.vendorName,
          };
        }

        if (
          !job.metrics.fastestDuration ||
          record.timeEstimateDays < job.metrics.fastestDuration.value
        ) {
          job.metrics.fastestDuration = {
            value: record.timeEstimateDays,
            vendorName: record.vendorName,
          };
        }
      }
    }

    // Convert internal job maps into JSON-serializable array structures.
    return Object.values(portfolio).map((proj) => ({
      ...proj,
      jobs: Object.values(proj.jobs),
    }));
  }
}
