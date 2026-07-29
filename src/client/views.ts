/**
 * @fileoverview HTML View rendering functions for the Job Bid Visualizer SPA.
 * Generates dynamic template markup for navigation breadcrumbs, project lists,
 * job scopes with vendor color legends and accepted counts, and vendor bid evaluation
 * dashboards featuring dynamic company-colored metric blocks and accepted proposal highlights.
 *
 * @module Views
 */

import { getVendorColor } from './colors.js';
import { state } from './state.js';
import { Bid, Job, Project } from './types.js';

/**
 * Interface returned by `renderBidsView` containing generated markup
 * and the subset of bids matching active user filter criteria.
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
 * Renders job scope cards for a selected project, displaying company-colored metric blocks,
 * accepted proposal counts, and vendor color legends for at-a-glance identification.
 *
 * @param project - Target project model containing job scopes.
 * @returns HTML markup representing jobs, color-coded metric benchmarks, and vendor legends.
 */
export function renderJobsView(project: Project): string {
  let html = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">`;

  project.jobs.forEach((job) => {
    // Collect unique vendors for the legend
    const vendors = Array.from(new Set(job.bids.map((b) => b.vendorName))).sort();
    let legendHtml = `<div class="flex flex-wrap gap-x-4 gap-y-2 mt-5 pt-4 border-t border-slate-100">`;
    vendors.forEach((v) => {
      legendHtml += `<div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full shadow-sm" style="background-color: ${getVendorColor(v)}"></span><span class="text-xs font-medium text-slate-600">${v}</span></div>`;
    });
    legendHtml += `</div>`;

    // Render accepted proposals badge if accepted bids exist.
    const acceptedBadge =
      job.metrics.acceptedCount > 0
        ? `<span class="bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded ml-3 uppercase">${job.metrics.acceptedCount} Accepted</span>`
        : '';

    /**
     * Helper function to construct vendor-colored metric card components.
     */
    const buildMetricHtml = (
      title: string,
      metric: { value: string | number; vendorName: string } | null,
      formatValue: (v: string | number) => string
    ): string => {
      if (!metric) return `<div class="text-slate-400 text-xs italic">N/A</div>`;
      const vColor = getVendorColor(metric.vendorName);
      return `
        <div class="border-l-4 pl-3 py-1 text-left bg-slate-50 rounded-r-md border-slate-200 transition-colors" style="border-color: ${vColor}">
            <p class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">${title}</p>
            <p class="font-bold text-sm truncate" style="color: ${vColor}">${metric.vendorName}</p>
            <p class="font-semibold text-slate-800 text-sm">${formatValue(metric.value)}</p>
        </div>`;
    };

    html += `
            <div data-job-id="${job.jobId}" class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 border-l-4 border-indigo-500 flex flex-col justify-between">
                <div>
                  <div class="flex justify-between items-start mb-1">
                    <h3 class="text-lg font-bold text-slate-800">${job.jobName}</h3>
                    ${acceptedBadge}
                  </div>
                  <p class="text-sm text-slate-500 mb-5">${job.jobId} • ${job.bids.length} Received Bids</p>
                  <div class="grid grid-cols-3 gap-3">
                      ${buildMetricHtml('Cheapest', job.metrics.lowestCost, (v) => '$' + Number(v).toLocaleString())}
                      ${buildMetricHtml('Soonest Start', job.metrics.soonestStart, (v) => String(v))}
                      ${buildMetricHtml('Fastest Finish', job.metrics.fastestDuration, (v) => v + ' Days')}
                  </div>
                </div>
                ${legendHtml}
            </div>
        `;
  });

  return html + `</div>`;
}

/**
 * Renders detailed vendor bid comparisons, interactive multi-select filter controls,
 * a top accepted proposals highlight panel, live vendor-attributed metric cards,
 * and the scatter plot chart canvas.
 *
 * @param job - Selected job scope model containing proposals.
 * @returns Object containing generated HTML markup and the filtered bids array.
 */
export function renderBidsView(job: Job): RenderBidsResult {
  let filteredBids = job.bids.filter((b) =>
    state.filters.statuses.includes(b.status.toLowerCase())
  );
  filteredBids = filteredBids.filter((b) => state.filters.vendors.includes(b.vendorName));

  if (state.filters.maxCost !== null) {
    filteredBids = filteredBids.filter((b) => b.costEstimate <= state.filters.maxCost!);
  }
  if (state.filters.maxDate !== null) {
    filteredBids = filteredBids.filter(
      (b) => new Date(b.estimatedFinishDate) <= state.filters.maxDate!
    );
  }

  // Dynamically calculate benchmark metrics based purely on active filter state.
  let minCostBid: Bid | null = filteredBids[0] || null;
  let fastestBid: Bid | null = filteredBids[0] || null;
  let soonestBid: Bid | null = filteredBids[0] || null;

  filteredBids.forEach((b) => {
    if (!minCostBid || b.costEstimate < minCostBid.costEstimate) minCostBid = b;
    if (!fastestBid || b.timeEstimateDays < fastestBid.timeEstimateDays) fastestBid = b;

    const bStart = b.earliestStartDate || b.estimatedFinishDate;
    const sStart = soonestBid ? soonestBid.earliestStartDate || soonestBid.estimatedFinishDate : '';
    if (!soonestBid || bStart < sStart) soonestBid = b;
  });

  /**
   * Helper function to construct vendor-attributed metric cards for the comparison banner.
   */
  const buildMetricHtml = (
    title: string,
    bid: Bid | null,
    formatValue: (b: Bid) => string
  ): string => {
    if (!bid) {
      return `<div class="text-slate-400 text-xs italic flex items-center justify-center h-full">No matching data</div>`;
    }
    const vColor = getVendorColor(bid.vendorName);
    return `
      <div class="border-l-4 pl-4 py-2 text-left bg-slate-50 rounded-r-md" style="border-color: ${vColor}">
          <p class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">${title}</p>
          <p class="font-bold text-base truncate" style="color: ${vColor}">${bid.vendorName}</p>
          <p class="font-semibold text-slate-800">${formatValue(bid)}</p>
      </div>`;
  };

  const allVendors = Array.from(new Set(job.bids.map((b) => b.vendorName))).sort();
  const allStatuses = ['accepted', 'pending', 'declined', 'revoked'];
  const maxDateStr = state.filters.maxDate ? state.filters.maxDate.toISOString().split('T')[0] : '';

  // Calculate top accepted bids block (unaffected by filter criteria).
  const acceptedBids = job.bids.filter((b) => b.status.toLowerCase() === 'accepted');
  let acceptedHtml = '';
  if (acceptedBids.length > 0) {
    acceptedHtml = `
        <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-6 shadow-sm">
           <h4 class="font-bold text-emerald-800 mb-3 flex items-center gap-2">
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             Accepted Proposals (${acceptedBids.length})
           </h4>
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             ${acceptedBids
               .map(
                 (b) => `
               <div class="bg-white rounded border border-emerald-100 p-4 shadow-sm flex flex-col h-full">
                 <div class="flex justify-between items-start mb-2">
                   <span class="font-bold text-lg" style="color: ${getVendorColor(b.vendorName)}">${b.vendorName}</span>
                   <span class="text-xs text-emerald-600 font-mono bg-emerald-100 px-2 py-0.5 rounded">${b.bidId}</span>
                 </div>
                 <div class="text-sm text-slate-600 flex justify-between border-t border-emerald-50 pt-2 mt-auto">
                   <span class="font-semibold text-slate-800">$${b.costEstimate.toLocaleString()}</span>
                   <span>Finishes: ${b.estimatedFinishDate}</span>
                 </div>
               </div>
             `
               )
               .join('')}
           </div>
        </div>
      `;
  }

  let html = `
        <div class="flex flex-col lg:flex-row gap-6 mb-8">
            <div class="w-full lg:w-1/4 bg-white p-6 rounded-lg shadow h-fit border border-slate-200">
                <h4 class="font-bold text-slate-800 mb-4 pb-2 border-b">Job Bid Filters</h4>
                
                <div class="mb-5">
                  <div class="flex justify-between items-center mb-2">
                     <label class="text-sm font-medium text-slate-700">Companies</label>
                     <button id="btn-show-all-vendors" class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Show All</button>
                  </div>
                  <div class="space-y-1.5 max-h-40 overflow-y-auto">
                     ${allVendors
                       .map(
                         (v) => `
                       <label class="flex items-center text-sm text-slate-600 cursor-pointer">
                         <input type="checkbox" class="filter-vendor mr-2 rounded text-indigo-600 focus:ring-indigo-500" value="${v}" ${
                           state.filters.vendors.includes(v) ? 'checked' : ''
                         }>
                         ${v}
                       </label>`
                       )
                       .join('')}
                  </div>
                </div>

                <div class="mb-5">
                  <label class="block text-sm font-medium text-slate-700 mb-2">Statuses</label>
                  <div class="space-y-1.5">
                     ${allStatuses
                       .map(
                         (s) => `
                       <label class="flex items-center text-sm text-slate-600 cursor-pointer capitalize">
                         <input type="checkbox" class="filter-status mr-2 rounded text-indigo-600 focus:ring-indigo-500" value="${s}" ${
                           state.filters.statuses.includes(s) ? 'checked' : ''
                         }>
                         ${s}
                       </label>`
                       )
                       .join('')}
                  </div>
                </div>

                <label class="block text-sm font-medium text-slate-700 mb-1 mt-4">Max Cost ($)</label>
                <input type="number" id="filter-cost" class="w-full mb-4 px-3 py-2 border rounded shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 15000" value="${
                  state.filters.maxCost || ''
                }">

                <label class="block text-sm font-medium text-slate-700 mb-1">Finish Before</label>
                <input type="date" id="filter-date" class="w-full mb-2 px-3 py-2 border rounded shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500" value="${maxDateStr}">
                
                <p class="text-xs text-slate-500 mt-4 text-center">Showing ${filteredBids.length} of ${job.bids.length} bids.</p>
            </div>
            
            <div class="w-full lg:w-3/4 flex flex-col gap-6">
                ${acceptedHtml}

                <div class="bg-white rounded-lg shadow p-4 border border-slate-200 grid grid-cols-3 gap-4">
                    ${buildMetricHtml('Cheapest', minCostBid, (b) => '$' + b.costEstimate.toLocaleString())}
                    ${buildMetricHtml('Soonest Start', soonestBid, (b) => b.earliestStartDate || b.estimatedFinishDate)}
                    ${buildMetricHtml('Fastest Finish', fastestBid, (b) => b.timeEstimateDays + ' Days')}
                </div>

                <div class="bg-white p-6 rounded-lg shadow border border-slate-200 flex-grow">
                    <h4 class="font-bold text-slate-800 mb-4 text-center">Cost vs. Estimated Finish Date</h4>
                    <div class="relative h-[300px] w-full">
                        <canvas id="bidsChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    `;

  filteredBids.forEach((bid) => {
    const badgeClass = STATUS_BADGE_MAP[bid.status.toLowerCase()] || STATUS_BADGE_MAP['pending'];
    html += `
            <div class="bg-white rounded-lg shadow p-5 border border-slate-200 flex flex-col">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-800 flex items-center gap-2">
                      <span class="w-3.5 h-3.5 rounded-full shadow-sm border border-black/10" style="background-color: ${getVendorColor(
                        bid.vendorName
                      )}"></span>
                      ${bid.vendorName}
                    </h4>
                    <span class="text-xs font-bold px-2 py-1 rounded border uppercase ${badgeClass}">${
                      bid.status
                    }</span>
                </div>
                <p class="text-xs text-slate-400 mb-4 font-mono">${bid.bidId}</p>
                <div class="space-y-2 text-sm text-slate-600 mt-auto">
                    <div class="flex justify-between border-b pb-1"><span>Est. Cost</span><span class="font-bold text-slate-900">$${bid.costEstimate.toLocaleString()}</span></div>
                    <div class="flex justify-between border-b pb-1"><span>Target Finish</span><span class="font-bold text-slate-900">${
                      bid.estimatedFinishDate
                    }</span></div>
                    <div class="flex justify-between"><span>Duration</span><span class="font-bold text-slate-900">${
                      bid.timeEstimateDays
                    } Days</span></div>
                </div>
            </div>
        `;
  });

  return { html: html + `</div>`, filteredBids };
}
