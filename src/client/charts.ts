/**
 * @fileoverview Chart rendering service for the Job Bid Visualizer client.
 * Handles Chart.js initialization, scatter plot mapping, color coding by vendor,
 * and canvas teardown/re-render lifecycle management.
 *
 * @module Charts
 */

import { getVendorColor } from './colors.js';
import { state } from './state.js';
import { Bid } from './types.js';

// Chart.js global declaration (injected via CDN in index.html)
declare const Chart: any;

/**
 * Internal interface representing a single data point mapped to the scatter chart axes.
 */
interface ScatterDataPoint {
  /** Timestamp representation of completion date used for linear X-axis alignment. */
  x: number;

  /** Total cost estimate in USD used for Y-axis placement. */
  y: number;

  /** Display name of the vendor who submitted the bid. */
  vendor: string;

  /** Proposal lifecycle status (e.g., "accepted", "pending"). */
  status: string;

  /** Original ISO 8601 string representation of the completion date. */
  dateStr: string;
}

/**
 * Color mapping configuration corresponding to bid status states.
 */
const STATUS_COLOR_MAP: Record<string, string> = {
  accepted: '#10b981', // Emerald
  pending: '#3b82f6', // Blue
  revoked: '#ef4444', // Red
  declined: '#64748b', // Slate
};

/**
 * Renders a scatter plot visualization comparing vendor cost estimates against project completion dates.
 * Destroys any existing Chart.js instance attached to global state before mounting a new chart.
 *
 * @param bids - Array of vendor bids to map onto the scatter chart.
 * @param canvasId - DOM element ID of the target `<canvas>` rendering context.
 */
export function renderChart(bids: Bid[], canvasId: string): void {
  const ctx = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!ctx) return;

  // Clean up existing Chart.js instance to prevent canvas re-use errors and memory leaks.
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  // Transform raw bid models into scatter plot coordinate data points.
  const dataPoints: ScatterDataPoint[] = bids.map((b) => ({
    x: new Date(b.estimatedFinishDate).getTime(),
    y: b.costEstimate,
    vendor: b.vendorName,
    status: b.status,
    dateStr: b.estimatedFinishDate,
  }));

  state.chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Vendor Bids',
          data: dataPoints,
          backgroundColor: dataPoints.map((p) => getVendorColor(p.vendor)),
          pointRadius: 8,
          pointHoverRadius: 10,
        },
      ],
    },
    options: {
      animation: false, // Disables Chart.js entry animations to allow instant snap updates during live data streaming.
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: { raw: ScatterDataPoint }) => {
              const pt = context.raw;
              return `${pt.vendor}: $${pt.y.toLocaleString()} (Finishes: ${pt.dateStr})`;
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            callback: (value: number) => new Date(value).toISOString().split('T')[0],
          },
          title: { display: true, text: 'Estimated Finish Date' },
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Cost Estimate ($)' },
          ticks: {
            callback: (value: number) => '$' + value.toLocaleString(),
          },
        },
      },
    },
  });
}
