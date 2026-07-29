/**
 * @fileoverview Main client-side application controller for the Job Bid Visualizer SPA.
 * Manages UI lifecycle rendering, view transition animations, global event delegation
 * for router navigation, checkbox/input filter bindings, and backend synchronization callbacks.
 *
 * @module App
 */

import { connectStream } from './api.js';
import { renderChart } from './charts.js';
import { state } from './state.js';
import { getBreadcrumbsHtml, renderBidsView, renderJobsView, renderProjectsView } from './views.js';

/** DOM Container References */
const contentEl = document.getElementById('app-content') as HTMLElement | null;
const breadcrumbsEl = document.getElementById('breadcrumbs') as HTMLElement | null;
const statusContainer = document.getElementById('connection-status') as HTMLElement | null;

/**
 * Triggers a view render cycle with smooth transition fade effects.
 * Updates breadcrumbs, mounts active view templates based on `state.currentView`,
 * and schedules chart renders for the bids comparison dashboard.
 */
function render(): void {
  if (!contentEl) return;

  // Initiate CSS opacity fade-out transition.
  contentEl.classList.add('fade-out');

  setTimeout(() => {
    if (state.data.length === 0) return;

    if (breadcrumbsEl) {
      breadcrumbsEl.classList.remove('hidden');
      breadcrumbsEl.innerHTML = getBreadcrumbsHtml();
    }

    // View Router Switching
    if (state.currentView === 'projects') {
      contentEl.innerHTML = renderProjectsView();
    } else if (state.currentView === 'jobs') {
      const project = state.data.find((p) => p.projectId === state.selectedProjectId);
      if (project) {
        contentEl.innerHTML = renderJobsView(project);
      }
    } else if (state.currentView === 'bids') {
      const project = state.data.find((p) => p.projectId === state.selectedProjectId);
      const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);

      if (job) {
        const { html, filteredBids } = renderBidsView(job);
        contentEl.innerHTML = html;

        // Schedule chart mounting after browser layout repaint.
        requestAnimationFrame(() => renderChart(filteredBids, 'bidsChart'));
      }
    }

    // Complete transition fade-in.
    contentEl.classList.remove('fade-out');
  }, 150);
}

/**
 * Global Click Event Delegation listener.
 * Handles client-side routing across projects, job scopes, "Show All" vendor resets, and breadcrumb navigation.
 */
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Breadcrumb and Header Router Navigation Actions
  // Evaluating closest [data-nav] first handles nested element clicks and prevents scroll jumping on <a> tags.
  const navItem = target.closest('[data-nav]') as HTMLElement | null;
  if (navItem) {
    e.preventDefault();
    const navTarget = navItem.dataset.nav;

    if (navTarget === 'projects') {
      state.currentView = 'projects';
      render();
    } else if (navTarget === 'jobs') {
      state.currentView = 'jobs';
      render();
    }
    return;
  }

  // Card Selection: Navigate to Project Scopes
  const projectCard = target.closest('[data-project-id]') as HTMLElement | null;
  if (projectCard) {
    state.selectedProjectId = projectCard.dataset.projectId || null;
    state.currentView = 'jobs';
    render();
    return;
  }

  // Card Selection: Navigate to Bids Comparison Dashboard and initialize default filter sets
  const jobCard = target.closest('[data-job-id]') as HTMLElement | null;
  if (jobCard) {
    state.selectedJobId = jobCard.dataset.jobId || null;
    state.currentView = 'bids';

    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);

    if (job) {
      state.filters = {
        maxCost: null,
        maxDate: null,
        vendors: Array.from(new Set(job.bids.map((b) => b.vendorName))),
        statuses: ['accepted', 'pending', 'declined'],
      };
    }

    render();
    return;
  }

  // Filter Action: Select/Show All Vendors
  if (target.id === 'btn-show-all-vendors') {
    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);
    if (job) {
      state.filters.vendors = Array.from(new Set(job.bids.map((b) => b.vendorName)));
      render();
    }
    return;
  }
});

/**
 * Global Input Event Delegation listener.
 * Dynamically binds numerical and date filter controls (max cost and date limits) to state and re-renders.
 */
document.addEventListener('input', (e: Event) => {
  const target = e.target as HTMLInputElement | null;
  if (!target) return;

  if (target.id === 'filter-cost') {
    state.filters.maxCost = target.value ? parseFloat(target.value) : null;
    render();
  } else if (target.id === 'filter-date') {
    state.filters.maxDate = target.value ? new Date(target.value) : null;
    render();
  }
});

/**
 * Global Change Event Delegation listener.
 * Manages checkbox state for vendor and status filters.
 */
document.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLInputElement | null;
  if (!target) return;

  if (target.classList.contains('filter-vendor')) {
    if (target.checked && !state.filters.vendors.includes(target.value)) {
      state.filters.vendors.push(target.value);
    } else if (!target.checked) {
      state.filters.vendors = state.filters.vendors.filter((v) => v !== target.value);
    }
    render();
  } else if (target.classList.contains('filter-status')) {
    if (target.checked && !state.filters.statuses.includes(target.value)) {
      state.filters.statuses.push(target.value);
    } else if (!target.checked) {
      state.filters.statuses = state.filters.statuses.filter((s) => s !== target.value);
    }
    render();
  }
});

/**
 * Callback handler invoked by the SSE stream when fresh ERP snapshot data is received.
 * Updates header connection status indicator securely and triggers UI view render.
 */
function onDataReceived(): void {
  if (statusContainer) {
    statusContainer.innerHTML =
      '<span class="w-2 h-2 rounded-full bg-emerald-400" id="status-dot"></span> Data Received';
  }
  render();
}

// Bootstrap application via Server-Sent Events connection.
connectStream(onDataReceived);
