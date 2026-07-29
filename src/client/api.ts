/**
 * @fileoverview Data retrieval service for the Job Bid Visualizer client.
 * Uses Server-Sent Events (SSE) for true real-time, event-driven updates,
 * eliminating HTTP polling overhead and inefficient JSON deep-diffing.
 *
 * @module API
 */

import { state } from './state.js';
import { Project } from './types.js';

/**
 * Establishes a persistent SSE connection to the backend middleware.
 * Automatically updates global state and triggers the UI render callback
 * when the server broadcasts a new ERP snapshot.
 *
 * @param onDataUpdated - Callback invoked when the server pushes fresh data.
 */
export function connectStream(onDataUpdated: () => void): void {
  const eventSource = new EventSource('/api/v1/visualizer/stream');

  eventSource.onmessage = (event: MessageEvent) => {
    try {
      const freshData: Project[] = JSON.parse(event.data);
      state.data = freshData;
      onDataUpdated();
    } catch (error) {
      console.error('Failed to parse incoming ERP stream data:', error);
    }
  };

  eventSource.onerror = () => {
    console.warn('SSE stream disconnected. Reconnecting...');
    // EventSource automatically handles reconnection logic natively.
  };
}
