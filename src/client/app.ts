/**
 * @fileoverview Main client-side application controller for the Job Bid Visualizer SPA.
 * Manages UI lifecycle rendering, transition animations, state hierarchy validation,
 * input focus restoration, job-scoped vendor auto-filtering, and global event delegation.
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
 * Tracks unique vendor names encountered for the currently focused job scope.
 * Used during live SSE stream updates to automatically select newly arrived vendors in active filters.
 */
const currentJobSeenVendors = new Set<string>();

/**
 * Triggers a view render cycle.
 * Validates state hierarchy integrity, preserves active element focus during live updates,
 * updates navigation breadcrumbs, and mounts active view templates.
 *
 * @param withTransition - If true, applies a fade-out/fade-in animation (for routing navigation).
 *                         If false, performs a synchronous DOM replacement (for filtering and live SSE syncs).
 */
function render(withTransition: boolean = true): void {
  if (!contentEl) return;
  if (state.data.length === 0) return;

  // 1. Hierarchy Validation: Automatically bump navigation state upward if current selections disappear.
  if (state.currentView === 'bids') {
    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    if (!project) {
      state.currentView = 'projects';
      state.selectedProjectId = null;
      state.selectedJobId = null;
    } else {
      const job = project.jobs.find((j) => j.jobId === state.selectedJobId);
      if (!job) {
        state.currentView = 'jobs';
        state.selectedJobId = null;
      }
    }
  } else if (state.currentView === 'jobs') {
    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    if (!project) {
      state.currentView = 'projects';
      state.selectedProjectId = null;
    }
  }

  // 2. Focus Preservation: Store active element ID prior to DOM updates.
  const activeElementId = document.activeElement?.id;

  // 3. Core DOM Render Logic
  const updateDOM = () => {
    if (breadcrumbsEl) {
      breadcrumbsEl.classList.remove('hidden');
      breadcrumbsEl.innerHTML = getBreadcrumbsHtml();
    }

    if (state.currentView === 'projects') {
      contentEl.innerHTML = renderProjectsView();
    } else if (state.currentView === 'jobs') {
      const project = state.data.find((p) => p.projectId === state.selectedProjectId);
      if (project) contentEl.innerHTML = renderJobsView(project);
    } else if (state.currentView === 'bids') {
      const project = state.data.find((p) => p.projectId === state.selectedProjectId);
      const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);

      if (job) {
        const { html, filteredBids } = renderBidsView(job);
        contentEl.innerHTML = html;

        // Schedule Chart.js mounting after browser layout repaint.
        requestAnimationFrame(() => renderChart(filteredBids, 'bidsChart'));
      }
    }

    // Restore input focus to prevent typing interruptions during live data streaming.
    if (activeElementId) {
      document.getElementById(activeElementId)?.focus();
    }
  };

  // 4. Execution Pathway
  if (withTransition) {
    contentEl.classList.add('fade-out');
    setTimeout(() => {
      updateDOM();
      contentEl.classList.remove('fade-out');
    }, 150);
  } else {
    updateDOM();
  }
}

/**
 * Global Click Event Delegation listener.
 * Handles client-side navigation routing, card selections, and "Show All" vendor filter resets.
 */
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Breadcrumb and Header Router Navigation Actions
  const navItem = target.closest('[data-nav]') as HTMLElement | null;
  if (navItem) {
    e.preventDefault(); // Prevents page scroll jumping on breadcrumb <a> tags.
    const navTarget = navItem.dataset.nav;

    if (navTarget === 'projects') {
      state.currentView = 'projects';
      render(true); // Fade transition for router navigation.
    } else if (navTarget === 'jobs') {
      state.currentView = 'jobs';
      render(true);
    }
    return;
  }

  // Card Selection: Navigate to Project Scopes
  const projectCard = target.closest('[data-project-id]') as HTMLElement | null;
  if (projectCard) {
    state.selectedProjectId = projectCard.dataset.projectId || null;
    state.currentView = 'jobs';
    render(true);
    return;
  }

  // Card Selection: Navigate to Bids Comparison Dashboard
  const jobCard = target.closest('[data-job-id]') as HTMLElement | null;
  if (jobCard) {
    state.selectedJobId = jobCard.dataset.jobId || null;
    state.currentView = 'bids';

    // Inject filter defaults and reset tracking for vendors in the focused job.
    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);
    if (job) {
      const initialVendors = Array.from(new Set(job.bids.map((b) => b.vendorName)));

      // Reset and register known vendors specifically for this job scope.
      currentJobSeenVendors.clear();
      initialVendors.forEach((v) => currentJobSeenVendors.add(v));

      state.filters = {
        maxCost: null,
        maxDate: null,
        vendors: [...initialVendors],
        statuses: ['accepted', 'pending', 'declined'],
      };
    }

    render(true);
    return;
  }

  // Show All Vendors Reset Action
  if (target.id === 'btn-show-all-vendors') {
    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);
    if (job) {
      state.filters.vendors = Array.from(new Set(job.bids.map((b) => b.vendorName)));
      render(false); // Seamless UI update without view transition.
    }
    return;
  }
});

/**
 * Global Input Event Delegation listener (Numerical & Date inputs).
 * Dynamically updates state filter criteria without causing screen flashes or losing focus.
 */
document.addEventListener('input', (e: Event) => {
  const target = e.target as HTMLInputElement | null;
  if (!target) return;

  if (target.id === 'filter-cost') {
    state.filters.maxCost = target.value ? parseFloat(target.value) : null;
    render(false); // Seamless update while typing.
  } else if (target.id === 'filter-date') {
    state.filters.maxDate = target.value ? new Date(target.value) : null;
    render(false);
  }
});

/**
 * Global Change Event Delegation listener (Vendor & Status checkboxes).
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
    render(false);
  } else if (target.classList.contains('filter-status')) {
    if (target.checked && !state.filters.statuses.includes(target.value)) {
      state.filters.statuses.push(target.value);
    } else if (!target.checked) {
      state.filters.statuses = state.filters.statuses.filter((s) => s !== target.value);
    }
    render(false);
  }
});

/**
 * Callback handler invoked by the SSE stream when fresh ERP snapshot data is received.
 * Automatically discovers brand-new vendors streamed into the active job scope and auto-enables them in active filters.
 */
function onDataReceived(): void {
  if (statusContainer) {
    statusContainer.innerHTML =
      '<span class="w-2 h-2 rounded-full bg-emerald-400" id="status-dot"></span> Data Ready';
  }

  // Auto-enable brand new vendors that just arrived for this specific job scope via the live stream.
  if (state.currentView === 'bids' && state.selectedProjectId && state.selectedJobId) {
    const project = state.data.find((p) => p.projectId === state.selectedProjectId);
    const job = project?.jobs.find((j) => j.jobId === state.selectedJobId);
    if (job) {
      job.bids.forEach((b) => {
        if (!currentJobSeenVendors.has(b.vendorName)) {
          currentJobSeenVendors.add(b.vendorName);
          if (!state.filters.vendors.includes(b.vendorName)) {
            state.filters.vendors.push(b.vendorName);
          }
        }
      });
    }
  }

  // Data arrived from server: Render seamlessly without disrupting current user focus or applying transitions.
  render(false);
}

// Bootstrap application via Server-Sent Events stream connection.
connectStream(onDataReceived);
