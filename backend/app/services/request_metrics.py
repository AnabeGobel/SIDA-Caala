from collections import Counter, deque
from datetime import datetime, timezone
from threading import Lock
from time import monotonic

MAX_SAMPLES = 500
started_at = datetime.now(timezone.utc)
_started_monotonic = monotonic()
_lock = Lock()
_request_count = 0
_client_error_count = 0
_server_error_count = 0
_last_request_at: str | None = None
_status_counts: Counter[str] = Counter()
_route_counts: Counter[str] = Counter()
_latency_samples: deque[float] = deque(maxlen=MAX_SAMPLES)


def record_request(method: str, route: str, status_code: int, duration_ms: float) -> None:
    global _request_count, _client_error_count, _server_error_count, _last_request_at
    if route in {"/api/admin/operations", "/api/admin/operations/monitoring"}:
        return

    with _lock:
        _request_count += 1
        _status_counts[str(status_code)] += 1
        _route_counts[f"{method} {route}"] += 1
        _latency_samples.append(duration_ms)
        _last_request_at = datetime.now(timezone.utc).isoformat()
        if 400 <= status_code < 500:
            _client_error_count += 1
        elif status_code >= 500:
            _server_error_count += 1


def get_request_metrics() -> dict:
    with _lock:
        samples = sorted(_latency_samples)
        sample_count = len(samples)
        p95_index = max(0, int(sample_count * 0.95) - 1)
        return {
            "uptime_seconds": round(monotonic() - _started_monotonic, 1),
            "total_requests": _request_count,
            "client_errors": _client_error_count,
            "server_errors": _server_error_count,
            "last_request_at": _last_request_at,
            "status_counts": dict(_status_counts),
            "recent_sample_count": sample_count,
            "recent_average_latency_ms": (
                round(sum(samples) / sample_count, 2) if sample_count else None
            ),
            "recent_p95_latency_ms": (
                round(samples[p95_index], 2) if sample_count else None
            ),
            "recent_max_latency_ms": (
                round(samples[-1], 2) if sample_count else None
            ),
            "top_routes": [
                {"route": route, "requests": count}
                for route, count in _route_counts.most_common(8)
            ],
        }
