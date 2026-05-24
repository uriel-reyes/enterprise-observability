# Enterprise Observability Dashboard

A Contentful App Framework app that streams a live CDA traffic dashboard inside the Contentful web app — no external hosting, no data pipeline, no S3 required.

Designed for **Contentful Enterprise demos** to illustrate the [Enterprise Observability](https://www.contentful.com/developers/docs/concepts/enterprise-observability/) feature story. The data is synthetic and generated in the browser, so it runs anywhere, any time, with zero configuration.

---

## One-click install

```
https://app.contentful.com/deeplink?link=apps&id=3QMPllrNgX6yayvCqYuqCu
```

Install into any space in your org. The app renders at the **Page** location and appears in the left nav as **Enterprise Observability**.

---

## What it shows

| Panel | Description |
|---|---|
| **Total Requests** | Running count of all CDA API calls in the session |
| **Success (2xx)** | Count + success rate % |
| **5xx Errors** | Server error count, turns red when non-zero |
| **Rate Limited (429)** | Rate-limit hit count, turns amber when non-zero |
| **p50 / p90 / p99 Latency** | Rolling percentile latency in ms, color-coded by threshold |
| **Requests / 30s window** | Spark bar chart showing request volume over the last 30 seconds |
| **Latency trend** | Spark bar chart showing latency over the same window |
| **Top Routes** | Most-called CDA query routes with hit counts |
| **Top Consumers** | Which services are calling the API most (agent, preview, portal, etc.) |
| **Live Log Stream** | Scrolling terminal-style log — timestamp, status, method, latency, route, consumer |

A **Pause / Resume** toggle freezes the stream for a closer look. **Clear** resets all counters.

---

## Demo narrative (Area 5 — Monitoring & Health)

> *"Contentful Enterprise includes a full observability export — every CDA request, status code, latency, and consumer is streamed to your S3 bucket in real time. You can pipe that into Datadog, Splunk, or anything else. Here we're showing it natively inside Contentful itself — same data, zero extra tooling."*

The synthetic data is tuned to a realistic traffic profile:
- ~96% 2xx success rate
- ~2% 429 rate-limits (typical burst behaviour)
- ~2% 4xx / 5xx errors
- Latency range 20–300ms, median ~140ms
- Consumers: `meta-ai-agent`, `slide-library-app`, `cms-preview`, `sales-portal`, `analytics-job`, `mcp-claude`
- Routes: real Contentful CDA query patterns against the demo space content model

---

## App locations

| Location | Rendered component |
|---|---|
| **Page** | Full observability dashboard |

No Config Screen needed — zero configuration, zero installation parameters.

---

## Repo layout

```
src/
├── App.tsx                    # Location router (Page → ObservabilityPage)
├── index.tsx                  # React root + SDKProvider
├── locations/
│   └── Page.tsx               # Main dashboard — KPIs, spark charts, top tables, log stream
├── components/
│   ├── LogStream.tsx          # Terminal-style scrolling log
│   ├── MetricCard.tsx         # KPI card with label, value, optional sub-text
│   └── SparkBar.tsx           # Mini bar chart for rolling window sparklines
└── lib/
    └── syntheticLogs.ts       # Synthetic log event generator (routes, consumers, status distribution)
```

---

## Local development

### Prerequisites

- Node.js 20+
- A Contentful org where you can create an App Definition
- A Contentful Personal Access Token (CMA scope)

### 1. Install

```bash
npm install
```

### 2. Set up `.env`

```bash
cp .env.example .env
# fill in CONTENTFUL_APP_DEF_ID and CONTENTFUL_MANAGEMENT_TOKEN
```

### 3. Start dev server

```bash
npm start
# → http://localhost:3013
```

In Contentful: **Apps → your app definition → set App URL to `http://localhost:3013`**. Install into a space, open from the left nav.

---

## Deploying (bundle upload)

```bash
npm run upload
```

The script builds the app and uploads it to Contentful's CDN via `@contentful/app-scripts`. When prompted, confirm activation. The app definition switches from localhost to the hosted bundle — no server required.

For subsequent updates:

```bash
npm run upload   # rebuilds + re-uploads + activates
```

---

## Available scripts

| Script | What it does |
|---|---|
| `npm start` | Dev server on port 3013 |
| `npm run build` | Production build to `build/` |
| `npm run upload` | Build + upload bundle to Contentful CDN |
| `npm run preview` | Local preview of production build |

---

## Tech stack

- React 18 + TypeScript
- [Forma 36](https://f36.contentful.com/) — Contentful's design system
- Contentful App SDK + `@contentful/react-apps-toolkit`
- Vite 5

---

## Extending to real data

When Contentful Enterprise Observability is configured for your org (S3 export), replace `generateLogEvent()` in `src/lib/syntheticLogs.ts` with a fetch to your log aggregation endpoint. The rest of the dashboard — KPI cards, spark charts, top tables, log stream — consumes a `LogEvent[]` array and needs no other changes.

```typescript
// LogEvent shape — swap in real data by returning this from your endpoint
export interface LogEvent {
  timestamp: string;   // ISO 8601
  method: string;      // 'GET'
  route: string;       // CDA path e.g. '/entries?content_type=slide'
  status: number;      // HTTP status code
  latencyMs: number;   // Response time in ms
  consumer: string;    // API consumer identifier
  spaceId: string;     // Contentful space ID
}
```

---

## License

MIT
