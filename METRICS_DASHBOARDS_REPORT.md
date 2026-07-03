# Phase 4 Sprint 2: Metrics & Dashboards

## Status

```
Phase 4 Sprint 2 — Metrics & Dashboards
Implementation:  PASS ✅
API build:       PASS ✅
Docker/Prometheus/Grafana runtime verification: PENDING ⏳
Reason: Docker Desktop unavailable at time of verification
```

## Runtime Verification Steps (when Docker Desktop is available)

```bash
# Start full stack + monitoring
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build -d

# Verify API metrics endpoint
curl http://localhost:3001/metrics

# Verify readiness probe
curl http://localhost:3001/api/v1/health/ready

# Check monitoring UIs
# Prometheus:  http://localhost:9090
# Grafana:     http://localhost:3002  (admin / homeland_grafana)
```

### Acceptance Criteria (must all pass before Sprint 2 is FULLY PASS)

- [ ] `curl http://localhost:3001/metrics` returns Prometheus text format with `http_requests_total`, `active_contracts_total`, `monthly_revenue`, etc.
- [ ] `curl http://localhost:3001/api/v1/health/ready` returns `{ "status": "READY" }`
- [ ] Prometheus `http://localhost:9090/targets` shows `homeland-api` target as **UP**
- [ ] Grafana `http://localhost:3002` — dashboard **HomeLand PMS — Overview** loads automatically
- [ ] Panels: Request Rate, P95 Latency, Error Rate, AI Tokens, Active Contracts, Monthly Revenue all render data

## Implemented Components

| File | Description |
|---|---|
| `apps/api/src/metrics/metrics.module.ts` | PrometheusModule + 8 metric providers |
| `apps/api/src/metrics/metrics.service.ts` | Business metric refresh + request recorder |
| `apps/api/src/metrics/metrics.interceptor.ts` | Auto HTTP request tracking |
| `apps/api/src/metrics/metrics.scheduler.ts` | Cron every 5 min refresh |
| `apps/api/src/health.controller.ts` | `/health` + `/health/ready` |
| `monitoring/prometheus.yml` | Scrape config |
| `docker-compose.monitoring.yml` | Prometheus + Grafana stack |
| `monitoring/grafana/provisioning/datasources/prometheus.yml` | Auto-provision Prometheus datasource |
| `monitoring/grafana/provisioning/dashboards/homeland-overview.json` | 8-panel dashboard |
