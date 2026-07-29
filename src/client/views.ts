/**
 * @fileoverview HTML View rendering functions for the Job Bid Visualizer SPA.
 * Generates dynamic template markup for navigation breadcrumbs, project lists,
 * job scopes, and vendor bid evaluation dashboards with active filtering.
 *
 * @module Views
 */

import { state } from './state.js';
import { Bid, Job, Project } from './types.js';

/**
 * Interface returned by `renderBidsView` containing generated markup
 * and the subset of bids matching current filter criteria.
 */
export interface RenderBidsResult {
  /** Generated HTML template string for the bids dashboard. */
  html: string;

  /** Array of bids filtered according to active user constraints. */
  filteredBids: Bid[];
}

/**
 * Status color mappings for bid badge highlights.
 */
const STATUS_BADGE_MAP: Record<string, string> = {
  accepted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
  revoked: 'bg-red-100 text-red-800 border-red-200',
  declined: 'bg-slate-100 text-slate-800 border-slate-200',
};

/**
 * Generates HTML string for top navigation breadcrumbs reflecting current UI state depth.
 *
 * @returns Rendered breadcrumb HTML string.
 */
export function getBreadcrumbsHtml(): string {
  if (state.currentView === 'projects') {
    return `<span class="text-indigo-600 font-bold">Projects Portfolio</span>`;
  }

  const project = state.data.find((p) => p.projectId === state.selectedProjectId);
  if (!project) return '';

  const html = `<a href="#" data-nav="projects" class="hover:text-indigo-600 transition-colors">Portfolio</a> <span class="mx-2">/</span>`;

  if (state.currentView === 'jobs') {
    return html + `<span class="text-indigo-600 font-bold">${project.projectId} Scopes</span>`;
  }

  const job = project.jobs.find((j) => j.jobId === state.selectedJobId);
  if (!job) return '';

  return (
    html +
    `
        <a href="#" data-nav="jobs" class="hover:text-indigo-600 transition-colors">${project.projectId}</a>
        <span class="mx-2">/</span>
        <span class="text-indigo-600 font-bold">${job.jobName} Comparison</span>
    `
  );
}

/**
 * Renders the top-level portfolio view containing project cards.
 *
 * @returns HTML markup representing available job bid projects.
 */
export function renderProjectsView(): string {
  let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;

  state.data.forEach((proj) => {
    html += `
            <div data-project-id="${proj.projectId}" class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 border border-slate-200">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-slate-800">${proj.projectId}</h2>
                    <span class="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded">${proj.jobs.length} Active Scopes</span>
                </div>
                <p class="text-slate-500 text-sm">Click to view jobs and bids for this project.</p>
            </div>
        `;
  });

  return html + `</div>`;
}

/**
 * Renders job scope cards for a selected project, displaying aggregated metrics.
 *
 * @param project - Target project model containing job scopes.
 * @returns HTML markup representing jobs and key metric benchmarks.
 */
export function renderJobsView(project: Project): string {
  let html = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">`;

  project.jobs.forEach((job) => {
    html += `
            <div data-job-id="${job.jobId}" class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 border-l-4 border-indigo-500">
                <h3 class="text-lg font-bold text-slate-800">${job.jobName}</h3>
                <p class="text-sm text-slate-500 mb-4">${job.jobId} • ${job.bids.length} Received Bids</p>
                <div class="grid grid-cols-3 gap-4 text-center text-sm border-t pt-4 border-slate-100">
                    <div>
                        <p class="text-slate-400 text-xs uppercase tracking-wider">Lowest Cost</p>
                        <p class="font-bold text-emerald-600">$${job.metrics.lowestCost.toLocaleString()}</p>
                    </div>
                    <div>
                        <p class="text-slate-400 text-xs uppercase tracking-wider">Soonest Start</p>
                        <p class="font-bold text-blue-600">${job.metrics.soonestStart}</p>
                    </div>
                    <div>
                        <p class="text-slate-400 text-xs uppercase tracking-wider">Fastest Build</p>
                        <p class="font-bold text-purple-600">${job.metrics.fastestDuration} Days</p>
                    </div>
                </div>
            </div>
        `;
  });

  return html + `</div>`;
}

/**
 * Renders detailed vendor bid comparisons, filter controls, and scatter chart container.
 * Applies active cost and completion date filters from state before rendering.
 *
 * @param job - Selected job scope model containing proposals.
 * @returns Object containing the generated HTML and filtered bids array.
 */
export function renderBidsView(job: Job): RenderBidsResult {
  let filteredBids = job.bids;

  if (state.filters.maxCost !== null) {
    filteredBids = filteredBids.filter((b) => b.costEstimate <= state.filters.maxCost!);
  }

  if (state.filters.maxDate !== null) {
    filteredBids = filteredBids.filter(
      (b) => new Date(b.estimatedFinishDate) <= state.filters.maxDate!
    );
  }

  const maxDateStr = state.filters.maxDate ? state.filters.maxDate.toISOString().split('T')[0] : '';

  let html = `
        <div class="flex flex-col lg:flex-row gap-6 mb-8">
            <div class="w-full lg:w-1/4 bg-white p-6 rounded-lg shadow h-fit border border-slate-200">
                <h4 class="font-bold text-slate-800 mb-4">Job Bid Filters</h4>
                
                <label class="block text-sm font-medium text-slate-700 mb-1">Max Cost ($)</label>
                <input type="number" id="filter-cost" class="w-full mb-4 px-3 py-2 border rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 15000" value="${state.filters.maxCost || ''}">

                <label class="block text-sm font-medium text-slate-700 mb-1">Finish Before</label>
                <input type="date" id="filter-date" class="w-full mb-4 px-3 py-2 border rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500" value="${maxDateStr}">
                
                <p class="text-xs text-slate-500">Showing ${filteredBids.length} of ${job.bids.length} bids.</p>
            </div>
            <div class="w-full lg:w-3/4 bg-white p-6 rounded-lg shadow border border-slate-200">
                <h4 class="font-bold text-slate-800 mb-4 text-center">Cost vs. Estimated Finish Date</h4>
                <div class="relative h-[300px] w-full">
                    <canvas id="bidsChart"></canvas>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    `;

  filteredBids.forEach((bid) => {
    const badgeClass = STATUS_BADGE_MAP[bid.status] || STATUS_BADGE_MAP['pending'];
    html += `
            <div class="bg-white rounded-lg shadow p-5 border border-slate-200">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-800">${bid.vendorName}</h4>
                    <span class="text-xs font-bold px-2 py-1 rounded border uppercase ${badgeClass}">${bid.status}</span>
                </div>
                <p class="text-xs text-slate-400 mb-4 font-mono">${bid.bidId}</p>
                <div class="space-y-2 text-sm text-slate-600 mb-4">
                    <div class="flex justify-between border-b pb-1"><span>Est. Cost</span><span class="font-bold text-slate-900">$${bid.costEstimate.toLocaleString()}</span></div>
                    <div class="flex justify-between border-b pb-1"><span>Target Finish</span><span class="font-bold text-slate-900">${bid.estimatedFinishDate}</span></div>
                    <div class="flex justify-between"><span>Duration</span><span class="font-bold text-slate-900">${bid.timeEstimateDays} Days</span></div>
                </div>
            </div>
        `;
  });

  return { html: html + `</div>`, filteredBids };
}
