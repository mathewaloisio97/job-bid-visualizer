/**
 * @fileoverview Global application state store for the Job Bid Visualizer SPA.
 * Holds initial runtime state including navigation depth, dynamic filters, and UI references.
 *
 * @module State
 */
/**
 * Central reactive application state instance.
 */
export const state = {
  /** Ingested project, job, and bid hierarchy payload. */
  data: [],
  /** Current active navigation layer within the UI hierarchy. */
  currentView: 'projects',
  /** Active project selection context. */
  selectedProjectId: null,
  /** Active job selection context. */
  selectedJobId: null,
  /** Active metrics threshold filters. */
  filters: {
    maxCost: null,
    maxDate: null,
  },
  /** Active Chart.js instance reference for lifecycle management. */
  chartInstance: null,
};
