# Job Bid Visualizer 📊

A lightweight, **stateless real-time dashboard service** and Single Page Application (SPA) designed to ingest, process, and visualize live job bid metrics from upstream ERP systems.

This project bridges the gap between raw CSV bid exports and actionable project management insights, offering an instant, live-updating dashboard without the overhead of a dedicated database.

---

## 🌟 Key Features

- **Stateless Architecture:** The backend relies entirely on in-memory state processing. It receives a data payload, transforms it, and immediately broadcasts it to clients. Perfect for ephemeral, containerized deployments.
- **Granular Data Ingestion:** Exposes secure REST endpoints to handle diverse upstream ERP sync patterns:
  - `/api/v1/visualizer/snapshot` - **Truncate:** Wipes existing data and replaces it entirely.
  - `/api/v1/visualizer/push` - **Upsert:** Seamlessly adds new bids or updates existing ones matching the Project/Job/Bid IDs.
  - `/api/v1/visualizer/remove/:projectId/:jobId/:bidId` - **Delete:** Removes a specific bid from the dashboard.
- **Real-Time SSE Synchronization:** Utilizes Server-Sent Events (SSE) to push dashboard updates to all connected web clients instantly, eliminating the need for HTTP polling.
- **Seamless UI Fallbacks:** Client automatically recalculates hierarchies on live updates, preserving user input focus and gracefully redirecting the user if their active view is deleted.
- **Schema Validation:** Strictly types and validates incoming ERP data using `Zod` to ensure dashboard integrity.
- **Adapter Pattern Design:** Highly extensible core logic allowing teams to easily swap out Authentication and Visualization rules via custom Adapters.

---

## 📈 Visualizations & Dashboards

The visualization dashboard is built to quickly surface the most competitive vendor bids across various project scopes:

- **Cost vs. Estimated Finish Date Scatter Plot:** An interactive Chart.js scatter plot allows project managers to visually weigh the tradeoff between a vendor's timeline and their proposed cost.
- **Dynamic Metric Banners:** Instantly highlights the **Cheapest Selected**, **Soonest Start**, and **Fastest Build** bids. These metrics dynamically recalculate as you adjust your filters.
- **Accepted Bid Highlights:** Approved bids are isolated into a highlighted "Accepted Proposals" section for immediate visibility.
- **Vendor Color-Coding:** Companies are assigned deterministic colors across the session. The scatter plot, metric banners, and individual bid cards all share this color coding for quick visual association.
- **Advanced Filtering:** Filter out bids interactively by maximum cost, target finish dates, specific vendor companies, or bid statuses (e.g., hiding 'declined' bids).

---

## ⏱️ The 30-Second Run

Get the project up and running, and push a test data snapshot in under a minute.

### 1. Install & Run

```bash
# Clone the repository
git clone <your-repo-url> job-bid-visualizer
cd job-bid-visualizer

# Install dependencies
npm install

# Start the development server (automatically builds the client TS first)
npm run dev
```

_The server will start on `http://localhost:3000`._

### 2. Open the Dashboard

Open your browser and navigate to [http://localhost:3000](http://localhost:3000). You will see the UI waiting for an initial data stream.

### 3. Ingest Test Data (Snapshot)

Open a second terminal window and run the built-in snapshot test script. This will mock an upstream ERP system pushing a full CSV to the ingestion endpoint:

```bash
npm run test:snapshot
```

_Look back at your browser—the dashboard will instantly populate with the ingested data via the SSE stream._

### 4. Live Data Streaming (Push)

To test granular, real-time upserts, run the live data watcher:

```bash
npm run test:livedata
```

Leave this terminal running and open `./data/sample-bids.csv` in your text editor. Try changing a cost, modifying a date, or adding a brand-new row. When you save the file, the script will automatically push the delta to the `/push` endpoint. The UI will instantly snap to the new data without refreshing.

### 5. Interactive Data Removal (Delete)

To test the system's ability to gracefully handle deleted records, run the remove CLI tool:

```bash
npm run test:removerow
```

This will launch an interactive prompt. Type the IDs of the bid you want to remove (e.g., `PRJ-401 JOB-102 BID-901`) and press Enter. If you are viewing that job in the browser, you will see the bid instantly vanish from the chart and metrics!

---

## 🧩 Implementing Adapters

The system is built using an Adapter Pattern to allow easy integration into different corporate environments. You can find these in `src/core/adapters/`.

### 1. Authentication Adapter (`AuthAdapter`)

By default, the system uses a `MockAuthAdapter` that checks for a static Bearer token. To connect to your corporate SSO or API Gateway, implement the `AuthAdapter` interface:

```typescript
import { Request } from 'express';

export interface AuthAdapter {
  authenticate(req: Request): Promise<{ systemId: string; role: string } | null>;
}

// Example Implementation:
export class JWTAuthAdapter implements AuthAdapter {
  async authenticate(req: Request) {
    const token = req.headers.authorization?.split(' ')[1];
    // ... verify token via corporate JWKS ...
    return verified ? { systemId: decoded.sub, role: decoded.role } : null;
  }
}
```

### 2. Visualization Adapter (`VisualizationAdapter`)

The Visualization adapter is responsible for transforming the flat array of validated `BidRecord` objects into the nested JSON hierarchy (`Project -> Job -> Bid`) expected by the frontend.

If your ERP system defines "Jobs" and "Projects" differently, simply create a new adapter:

```typescript
import { BidRecord } from '../schemas/bid-record.schema';

export class CustomVisualizationAdapter {
  buildPortfolioDashboard(records: BidRecord[]) {
    // 1. Group records by your custom logic
    // 2. Compute aggregate metrics (Lowest Cost, Accepted count, etc.)
    // 3. Return the Array of Project objects expected by the frontend UI
    return mappedProjectsArray;
  }
}
```

---

## 🛠️ Technology Stack

**Backend**

- Node.js / Express
- TypeScript
- `zod` - Schema validation
- `multer` / `csv-parser` - File upload and CSV stream parsing

**Frontend**

- Vanilla HTML / DOM manipulation (No heavy frameworks required)
- TypeScript (compiled to ESNext modules)
- `Tailwind CSS` (via CDN for lightweight styling)
- `Chart.js` (via CDN for canvas-based visualizations)
- Native `EventSource` API for Server-Sent Events (SSE)

**Tooling**

- `tsx` - Fast TypeScript execution for the Node server
- `esbuild` - Under the hood of tsx for fast transpilation
- `prettier` - Code formatting
