"""Prometheus metrics. Exposed at /metrics (see main.py).

These back the AIOps dashboards described in docs/10-aiops-monitoring.md.
"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

http_requests_total = Counter(
    "amvp_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)

http_request_duration_seconds = Histogram(
    "amvp_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

inference_duration_seconds = Histogram(
    "amvp_inference_duration_seconds",
    "Model inference latency",
    ["model", "modality"],
    buckets=(0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)

inference_confidence = Histogram(
    "amvp_inference_confidence",
    "Distribution of top-1 confidence per model (drift signal)",
    ["model"],
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
)

agent_runs_total = Counter(
    "amvp_agent_runs_total",
    "Agent invocations",
    ["agent", "task", "status"],
)

queue_depth = Gauge(
    "amvp_queue_depth",
    "Pending jobs in the inference queue",
)
