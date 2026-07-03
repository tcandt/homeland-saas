# Phase 4 Sprint 3: Alerting Rules & SLO Dashboard

## Status

```
Phase 4 Sprint 3 — Alerting Rules & SLO Dashboard
Implementation:  PASS ✅  (configuration complete)
Runtime verification: PENDING ⏳  (requires Docker Desktop)
```

## Alert Rules Implemented

| Alert | Condition | Severity | For |
|---|---|---|---|
| `APIDown` | `up{job="homeland-api"} == 0` | critical | 1m |
| `HighErrorRate5xx` | 5xx rate > 5% | critical | 5m |
| `HighErrorRate4xx` | 4xx rate > 10% | warning | 5m |
| `HighP95Latency` | P95 > 2s | warning | 10m |
| `HighP99Latency` | P99 > 5s | critical | 10m |
| `NotificationQueueBacklog` | failed > 10 | warning | 5m |
| `AIHighErrorRate` | AI route error > 10% | warning | 10m |
| `AutomationHighFailureRate` | Automation error > 5% | warning | 10m |
| `SLOErrorBudgetFastBurn` | 1h error rate > 14× budget | critical | 2m |
| `SLOErrorBudgetSlowBurn` | 6h error rate > 6× budget | warning | 15m |

## SLO Definition

```
Service: HomeLand API
SLI: HTTP success rate (non-5xx / total requests)
SLO Target: 99.5% availability
Error Budget: 0.5% = ~3h 36m per 30-day month
Burn Rate Windows: 1h (fast) and 6h (slow)
```

## SLO Dashboard Panels

| Panel | Query |
|---|---|
| Availability (1h) | `1 - error_rate[1h]` |
| Error Budget Remaining | `(1 - error_rate[30d]) / 0.005` |
| P95 Latency | `histogram_quantile(0.95, ...)` |
| Burn Rate (1h) | `error_rate[1h] / 0.005` |
| Availability Over Time | time-series with SLO target line |
| Burn Rate (1h + 6h) | dual-window with threshold lines |
| Latency Percentiles | P50 / P95 / P99 with SLO limit |

## AlertManager

- Config: `monitoring/alertmanager.yml`
- Receivers: `default-webhook`, `critical-webhook`, `ai-team-webhook`, `slo-webhook`
- Inhibit: warning suppressed when critical fires for same `alertname + team`
- Notification channels: **webhook stubs** (Slack config commented, ready to enable)

## Runtime Verification Checklist (requires Docker Desktop)

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build -d
```

- [ ] Prometheus `http://localhost:9090/alerts` — all rules loaded
- [ ] AlertManager `http://localhost:9093` — reachable, config valid
- [ ] Prometheus `http://localhost:9090/targets` — homeland-api, alertmanager = UP
- [ ] Grafana `http://localhost:3002` — dashboard **HomeLand PMS — SLO Dashboard** loads
- [ ] SLO panels render: Availability ≥ 99.5%, Burn Rate = nominal

## Files Changed

| File | Action |
|---|---|
| `monitoring/prometheus-rules.yml` | NEW — 10 alert rules across 5 groups |
| `monitoring/alertmanager.yml` | NEW — routing, receivers, inhibit rules |
| `monitoring/prometheus.yml` | UPDATED — added rule_files + alertmanager target |
| `docker-compose.monitoring.yml` | UPDATED — added alertmanager service + volume |
| `monitoring/grafana/provisioning/dashboards/homeland-slo.json` | NEW — SLO dashboard |
