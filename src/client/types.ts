/**
 * @fileoverview Data models, state definitions, and domain types for the Job Bid Visualizer.
 * Defines the core structure for ERP job bid payloads, metrics, filters, and application state.
 *
 * @module Types
 */

import type { Chart } from 'chart.js';

/**
 * Represents an individual vendor submission/bid for a specific job.
 */
export interface Bid {
  /** Unique identifier for the vendor bid (e.g., "BID-901"). */
  bidId: string;

  /** Display name of the vendor submitting the proposal. */
  vendorName: string;

  /** Current lifecycle status of the proposal (e.g., "PENDING", "ACCEPTED", "REJECTED"). */
  status: string;

  /** Total estimated cost quoted by the vendor in USD. */
  costEstimate: number;

  /** Projected completion date quoted by the vendor (ISO 8601 formatted string: "YYYY-MM-DD"). */
  estimatedFinishDate: string;

  /** Estimated total duration required to complete work, measured in calendar days. */
  timeEstimateDays: number;
}

/**
 * Calculated aggregate metrics derived across all valid bids submitted for a single job.
 */
export interface JobMetrics {
  /** Lowest cost estimate submitted across all active bids for the job. */
  lowestCost: number;

  /** Earliest estimated finish date among all active bids (ISO 8601 formatted string: "YYYY-MM-DD"). */
  soonestStart: string;

  /** Shortest execution duration in days across all active bids. */
  fastestDuration: number;
}

/**
 * Represents a discrete job unit within a project containing multiple vendor bids and computed metrics.
 */
export interface Job {
  /** Unique identifier for the job (e.g., "JOB-102"). */
  jobId: string;

  /** Human-readable title or description of the job scope. */
  jobName: string;

  /** Array of vendor proposals submitted for this specific job. */
  bids: Bid[];

  /** Aggregated performance and cost benchmark metrics for the job. */
  metrics: JobMetrics;
}

/**
 * Top-level organizational container representing a project and its child jobs.
 */
export interface Project {
  /** Unique identifier for the overarching project (e.g., "PRJ-401"). */
  projectId: string;

  /** Collection of individual jobs associated with this project. */
  jobs: Job[];
}

/**
 * Client-side filter criteria used to dynamically narrow down visual analytics.
 */
export interface Filters {
  /** Upper monetary threshold for bid filtering. Null if no cost limit is set. */
  maxCost: number | null;

  /** Upper completion date threshold for bid filtering. Null if no time limit is set. */
  maxDate: Date | null;
}

/**
 * Single Page Application (SPA) reactive state container.
 * Tracks navigation depth, user selection, active filters, and rendering instances.
 */
export interface AppState {
  /** Ingested hierarchy of project, job, and bid data. */
  data: Project[];

  /** Current active navigation view level in the UI hierarchy. */
  currentView: 'projects' | 'jobs' | 'bids';

  /** Currently focused project ID. Null if viewing top-level project list. */
  selectedProjectId: string | null;

  /** Currently focused job ID. Null if viewing project or list level. */
  selectedJobId: string | null;

  /** Active criteria applied to filter visual dashboard metrics. */
  filters: Filters;

  /** Active Chart.js instance ref used for cleanup, re-rendering, and updates. */
  chartInstance: Chart | null;
}
