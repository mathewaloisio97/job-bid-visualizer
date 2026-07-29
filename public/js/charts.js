/**
 * @fileoverview Chart rendering service for the Job Bid Visualizer client.
 * Handles Chart.js initialization, scatter plot mapping, color coding by status,
 * and canvas teardown/re-render lifecycle management.
 *
 * @module Charts
 */
import { state } from './state.js';
/**
 * Color mapping configuration corresponding to bid status states.
 */
const STATUS_COLOR_MAP = {
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
export function renderChart(bids, canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  // Clean up existing Chart.js instance to prevent canvas re-use errors and memory leaks.
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }
  // Transform raw bid models into scatter plot coordinate data points.
  const dataPoints = bids.map((b) => ({
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
          backgroundColor: dataPoints.map(
            (p) => STATUS_COLOR_MAP[p.status] || STATUS_COLOR_MAP['pending']
          ),
          pointRadius: 8,
          pointHoverRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
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
            callback: (value) => new Date(value).toISOString().split('T')[0],
          },
          title: { display: true, text: 'Estimated Finish Date' },
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Cost Estimate ($)' },
          ticks: {
            callback: (value) => '$' + value.toLocaleString(),
          },
        },
      },
    },
  });
}
