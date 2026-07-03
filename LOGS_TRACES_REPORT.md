# Phase 4 Sprint 4: Log Aggregation & Trace Explorer

## Status

```
Phase 4 Sprint 4 — Log Aggregation & Trace Explorer
Implementation:  PASS ✅  (configuration complete, API build pending)
Runtime verification: PENDING ⏳  (requires Docker Desktop)
```

## Stack Overview

| Component | Role | Port |
|---|---|---|
| **Loki** | Log storage & query backend | `:3100` |
| **Promtail** | Docker log shipper → Loki | `:9080` |
| **Tempo** | Distributed trace backend (OTLP) | `:3200` / `:4317` / `:4318` |
| **Grafana** | Unified visualization | `:3002` |

## Data Flow

```
NestJS (pino JSON logs)
  └─ Docker stdout
       └─ Promtail (docker_sd + pipeline stages)
            └─ Loki (indexed by level, service, correlationId)
                 └─ Grafana (log search + trace-to-log linking)

NestJS (OTel spans)
  └─ OTLP HTTP → http://tempo:4318/v1/traces
       └─ Tempo (trace store + service graph)
            └─ Grafana (trace explorer + node graph)
```

## Trace-to-Log Linking

Configured in `datasources/prometheus.yml`:
- **Loki → Tempo**: `derivedFields` extracts `traceId` from JSON logs → link to Tempo UI
- **Tempo → Loki**: `tracesToLogs` queries `{compose_service="api"} | json | traceId="<id>"` for each trace

## Grafana Dashboards (auto-provisioned)

| Dashboard | UID | Purpose |
|---|---|---|
| HomeLand PMS — Overview | `homeland-overview` | Request rate, latency, business KPIs |
| HomeLand PMS — SLO Dashboard | `homeland-slo` | Availability, burn rate, error budget |
| HomeLand PMS — Correlation ID Search | `homeland-logs` | Log search by correlationId / userId / error level |
| HomeLand PMS — Trace Explorer | `homeland-traces` | TraceQL search, service graph, P95 by operation |

## Promtail Pipeline

JSON pino logs are parsed and promoted:
- **Labels** (low-cardinality): `level`, `service`, `compose_service`
- **Structured metadata**: `traceId`, `spanId`, `correlationId`

## Files Changed

| File | Action |
|---|---|
| `monitoring/loki-config.yml` | NEW — Loki v3 config, filesystem storage |
| `monitoring/promtail-config.yml` | NEW — Docker SD + JSON pipeline stages |
| `monitoring/tempo-config.yml` | NEW — OTLP receiver, metrics generator, Prometheus remote write |
| `monitoring/grafana/provisioning/datasources/prometheus.yml` | UPDATED — Added Loki + Tempo with trace-to-log linking |
| `monitoring/grafana/provisioning/dashboards/homeland-logs.json` | NEW — Correlation ID / error log search |
| `monitoring/grafana/provisioning/dashboards/homeland-traces.json` | NEW — Trace Explorer + Service Graph |
| `docker-compose.monitoring.yml` | UPDATED — Added Loki, Promtail, Tempo services |
| `docker-compose.yml` | UPDATED — Added `OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318` |
| `apps/api/src/instrumentation.ts` | UPDATED — Dynamic endpoint, ignore /metrics + /health from tracing |

## Runtime Verification Checklist

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build -d
```

- [ ] Loki `http://localhost:3100/ready` → `ready`
- [ ] Promtail `http://localhost:9080/targets` → homeland_api container = active
- [ ] Tempo `http://localhost:3200/ready` → `ready`
- [ ] Grafana → datasource Loki = Connected ✅
- [ ] Grafana → datasource Tempo = Connected ✅
- [ ] Grafana → dashboard **Correlation ID Search** loads
- [ ] Grafana → dashboard **Trace Explorer** loads
- [ ] Click a trace in Tempo → "Logs for this trace" opens Loki search

## Full Phase 4 Status

| Sprint | Implementation | Runtime |
|---|---|---|
| Sprint 1 — Observability Foundation | ✅ PASS | ⏳ PENDING |
| Sprint 2 — Metrics & Dashboards | ✅ PASS | ⏳ PENDING |
| Sprint 3 — Alerting & SLO | ✅ PASS | ⏳ PENDING |
| Sprint 4 — Log Aggregation & Trace Explorer | ✅ PASS | ⏳ PENDING |
