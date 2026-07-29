/**
 * @fileoverview Main client-side application controller for the Job Bid Visualizer SPA.
 * Manages UI lifecycle rendering, view transition animations, global event delegation
 * for router navigation, filter bindings, and backend synchronization callbacks.
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
 * Handles client-side routing across projects, job scopes, and breadcrumb navigation.
 */
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Card Selection: Navigate to Project Scopes
  const projectCard = target.closest('[data-project-id]') as HTMLElement | null;
  if (projectCard) {
    state.selectedProjectId = projectCard.dataset.projectId || null;
    state.currentView = 'jobs';
    render();
    return;
  }

  // Card Selection: Navigate to Bids Comparison Dashboard
  const jobCard = target.closest('[data-job-id]') as HTMLElement | null;
  if (jobCard) {
    state.selectedJobId = jobCard.dataset.jobId || null;
    state.currentView = 'bids';
    state.filters = { maxCost: null, maxDate: null }; // Reset active filters on job switch.
    render();
    return;
  }

  // Breadcrumb Router Navigation Actions
  if (target.dataset.nav === 'projects') {
    state.currentView = 'projects';
    render();
  } else if (target.dataset.nav === 'jobs') {
    state.currentView = 'jobs';
    render();
  }
});

/**
 * Global Input Event Delegation listener.
 * Dynamically binds filter controls (max cost and date limits) to state and re-renders.
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
 * Callback handler invoked by the SSE stream when fresh ERP snapshot data is received.
 * Updates header connection status indicator securely and triggers UI view render.
 */
function onDataReceived(): void {
  if (statusContainer) {
    // Safely replace the entire inner HTML to avoid fragile childNodes indexing.
    statusContainer.innerHTML =
      '<span class="w-2 h-2 rounded-full bg-emerald-400" id="status-dot"></span> Live Synced';
  }
  render();
}

// Bootstrap application via Server-Sent Events connection.
connectStream(onDataReceived);
