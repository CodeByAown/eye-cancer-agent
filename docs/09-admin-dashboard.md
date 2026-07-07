# Admin Dashboard — Enterprise Administration Portal

A separate authenticated area (RBAC: `admin`, `org_admin`) modeled on enterprise healthcare AI platforms. Read-heavy analytics + governance controls.

## Sections

| Section                 | Shows                                                             | Key actions                                                   |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| **Users**               | list, roles, org, activity, last login                            | invite, deactivate, change role                               |
| **Organizations**       | tenants, plan, usage, branding                                    | create, configure white-label, quotas                         |
| **Scan History**        | all scans, filters (module/modality/status/date)                  | inspect, re-run, delete                                       |
| **Reports**             | generated reports, exports                                        | view, regenerate, revoke share link                           |
| **AI Models**           | registered agents + models, license, `commercial_ok`, metrics     | activate/deactivate                                           |
| **Model Versions**      | version history, artifact hash, eval metrics                      | promote, rollback, canary %                                   |
| **API Usage**           | per-user/org calls, quotas, keys                                  | rotate keys, set limits                                       |
| **Audit Logs**          | append-only actions (who/what/when/ip)                            | filter, export (compliance)                                   |
| **Analytics**           | scans over time, module mix, confidence distributions, conversion | date ranges, export CSV                                       |
| **System Health**       | service up/down (db, redis, gpu, agents), readiness               | drill into [`10-aiops-monitoring.md`](10-aiops-monitoring.md) |
| **Error Logs**          | Sentry-linked errors, rates, top issues                           | acknowledge, link to trace                                    |
| **Background Jobs**     | queue depth, running/failed jobs, retries                         | retry, cancel, purge                                          |
| **Performance Metrics** | inference latency, throughput, p95/p99, resource use              | time-series, alerts                                           |

## Data model additions

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT, hashed_key TEXT NOT NULL, scopes TEXT[],
  rate_limit INT, last_used_at TIMESTAMPTZ, revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE api_usage (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID, user_id UUID, endpoint TEXT, status INT,
  latency_ms INT, tokens INT, cost_cents INT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON api_usage (created_at);
CREATE TABLE jobs (                        -- mirror of queue state for admin view
  id UUID PRIMARY KEY, type TEXT, scan_id UUID, status TEXT,
  attempts INT DEFAULT 0, error TEXT,
  enqueued_at TIMESTAMPTZ, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ
);
CREATE TABLE model_metrics (               -- rolling inference telemetry per model
  id BIGSERIAL PRIMARY KEY, model_name TEXT, model_version TEXT,
  window_start TIMESTAMPTZ, requests INT, avg_latency_ms INT, p95_latency_ms INT,
  error_rate NUMERIC, avg_confidence NUMERIC
);
```

(Builds on `users`, `organizations`, `scans`, `predictions`, `reports`, `audit_logs`, `model_registry` from [`02-architecture.md`](02-architecture.md).)

## Admin API

```
GET   /api/v1/admin/users            ?role=&org=&page=
PATCH /api/v1/admin/users/{id}       # role, status
GET   /api/v1/admin/orgs
POST  /api/v1/admin/orgs
GET   /api/v1/admin/scans            ?module=&status=&from=&to=
GET   /api/v1/admin/reports
GET   /api/v1/admin/models
POST  /api/v1/admin/models/{id}/activate
POST  /api/v1/admin/models/{id}/rollback
GET   /api/v1/admin/api-usage        ?org=&from=&to=
POST  /api/v1/admin/api-keys         # create / rotate
GET   /api/v1/admin/audit            ?actor=&action=&from=&to=
GET   /api/v1/admin/analytics/summary
GET   /api/v1/admin/health           # aggregated system health
GET   /api/v1/admin/jobs             ?status=
POST  /api/v1/admin/jobs/{id}/retry
GET   /api/v1/admin/errors           # Sentry proxy
GET   /api/v1/admin/metrics          # performance time-series
```

All admin endpoints require `admin`/`org_admin` scope, are rate-limited, and every mutating call writes to `audit_logs`.

## UI

Same design system; data-dense tables with server-side pagination/filtering, charts (Recharts), status pills, drill-downs, CSV export. Org-scoped views for `org_admin`, global for `admin`.
