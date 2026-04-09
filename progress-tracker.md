# NeuroVault — Progress Tracker

> Updated live as tasks are completed. April 9 – 16, 2026.

---

## Day 1 — April 9 — Project Setup + Collector Foundation

### Chunk 1.1 — Scaffolding + Mouse Collector
- [ ] Initialize repository with planning + constitution files
- [ ] Create full directory structure (collector, backend, dashboard)
- [ ] Set up Python venv + `requirements.txt`
- [ ] Create `neurovault.js` class skeleton (constructor, start, stop)
- [ ] Implement `_onMouseMove` handler at 60 Hz with timestamp
- [ ] Implement event normalization (compute dx, dy)
- [ ] Create `test-harness.html` for collector testing
- [ ] Verify: mouse events log to console in harness

### Chunk 1.2 — Key + Scroll + Batching
- [ ] Implement `_onKeyDown` handler with flight-time computation
- [ ] Implement `_onKeyUp` handler with dwell-time computation
- [ ] Implement `_onScroll` handler with velocity calculation
- [ ] Build `_flushBatch()` — assemble TelemetryBatch JSON
- [ ] Add 100 ms `setInterval` for automatic batch flush
- [ ] Add event counters and `getStats()` method
- [ ] Verify: batches print to console at 100 ms intervals

---

## Day 2 — April 10 — Collector Polish + WebSocket Backend

### Chunk 2.1 — WebSocket Client
- [ ] Implement `_connect()` using native WebSocket API
- [ ] Implement `_reconnect()` with exponential backoff (max 5 s)
- [ ] Wire `_flushBatch()` to send via WebSocket (queue when disconnected)
- [ ] Add connection state tracking (connecting, open, closed, error)
- [ ] Add `onConnectionChange` callback
- [ ] Verify: collector retries connection when backend is offline

### Chunk 2.2 — FastAPI Backend Skeleton
- [ ] Create `main.py` with FastAPI app + CORS + health endpoint
- [ ] Create `schemas.py` with all Pydantic models
- [ ] Create `handler.py` with WebSocket endpoint
- [ ] Parse incoming batches against TelemetryBatch schema
- [ ] Initialize SQLite database via `db.py`
- [ ] Verify: collector connects, batches received and validated

---

## Day 3 — April 11 — Pipeline E2E + Feature Extraction Start

### Chunk 3.1 — Pipeline Reliability
- [ ] Add session creation on first WebSocket connection
- [ ] Store raw batches in SQLite `telemetry_batches` table
- [ ] Add batch sequence validation (detect dropped batches)
- [ ] Add heartbeat/ping-pong for stale connection detection
- [ ] Add graceful cleanup on WebSocket disconnect
- [ ] E2E verify: collector → WebSocket → FastAPI → SQLite roundtrip

### Chunk 3.2 — Mouse Feature Extraction
- [ ] Create `feature_extractor.py` with `FEATURE_NAMES` list
- [ ] Implement `extract_mouse_features()` — 6 features
- [ ] Write unit tests with synthetic mouse data
- [ ] Verify: feed captured data → confirm feature vector output

---

## Day 4 — April 12 — Feature Extraction + Isolation Forest

### Chunk 4.1 — Key + Scroll Features
- [ ] Implement `extract_keystroke_features()` — 5 features
- [ ] Implement `extract_scroll_features()` — 4 features
- [ ] Implement `extract_features()` — combined 15-dim vector
- [ ] Define and verify `FEATURE_NAMES` ordering
- [ ] Write unit tests for key and scroll extractors

### Chunk 4.2 — Isolation Forest Enrollment
- [ ] Create `isolation_forest.py` with `BiometricEngine` class
- [ ] Implement `begin_enrollment()` + `add_enrollment_window()`
- [ ] Implement `complete_enrollment()` — fit IsolationForest
- [ ] Implement `is_enrolled()` check
- [ ] Wire enrollment into WebSocket handler
- [ ] Verify: collect 3 min of data, model trains successfully

---

## Day 5 — April 13 — Scoring + Persistence

### Chunk 5.1 — Real-time Scoring
- [ ] Implement `score()` — decision_function → 0–100 normalization
- [ ] Add scoring loop in WebSocket handler (5-second windows)
- [ ] Send `TrustScoreResponse` back to client at window boundaries
- [ ] Tune threshold: enrolled user scores 85+, stranger scores < 50
- [ ] Verify: self-data scores high, different user scores low

### Chunk 5.2 — Profile Persistence + Demo Profile
- [ ] Create `profile_manager.py` with `ProfileManager` class
- [ ] Implement `save_model()` — joblib serialization + SQLite metadata
- [ ] Implement `load_model()` — deserialize from disk
- [ ] Implement `load_demo_profile()`
- [ ] Add REST endpoints: GET /profiles, DELETE /profiles/{id}
- [ ] Generate and save a demo profile from own enrollment
- [ ] Verify: restart server → load profile → score correctly

---

## Day 6 — April 14 — SHAP Layer + Dashboard Start

### Chunk 6.1 — SHAP Explainability
- [ ] Create `shap_explainer.py` with `ShapExplainer` class
- [ ] Implement `explain()` using `shap.TreeExplainer`
- [ ] Implement `_humanize_feature()` for all 15 features
- [ ] Wire into scoring pipeline — SHAP in every TrustScoreResponse
- [ ] Verify: scoring produces human-readable SHAP text

### Chunk 6.2 — Dashboard Scaffold + Trust Ring
- [ ] Initialize React + Vite project in `dashboard/`
- [ ] Install Recharts, configure CSS variables (brand guidelines)
- [ ] Create `useWebSocket.js` hook
- [ ] Build `TrustScoreRing.jsx` — SVG arc, 180px, stroke-width 12
- [ ] Implement score-based color transitions (teal/amber/red)
- [ ] Score number: 48px JetBrains Mono centered
- [ ] Verify: hardcoded score renders per brand spec

---

## Day 7 — April 15 — Dashboard Completion

### Chunk 7.1 — Live Graph + SHAP Panel
- [ ] Build `LiveGraph.jsx` — Recharts line chart, dark bg
- [ ] Add dotted baseline at 85, solid line for live score
- [ ] Rolling 60-second X-axis window
- [ ] Build `ShapBreakdown.jsx` — top 5 features, bars, descriptions
- [ ] Color-code: teal (authentic) / red (anomalous)
- [ ] Wire to live WebSocket data via `useTrustScore.js`
- [ ] Verify: live data streams → graph updates + SHAP refreshes

### Chunk 7.2 — Session Lock + Enrollment + Status
- [ ] Build `SessionLockOverlay.jsx` — full viewport red overlay
- [ ] "MOTOR MISMATCH DETECTED" at 32px, trigger feature at 18px
- [ ] Lock triggers after 2 consecutive anomalous windows
- [ ] Build `EnrollmentProgress.jsx` — progress bar 0–180s
- [ ] Build `StatusIndicator.jsx` — connection dot + mode label
- [ ] Verify: all dashboard states render correctly

---

## Day 8 — April 16 — Integration + Demo + Polish

### Chunk 8.1 — Demo Mode + E2E Testing
- [ ] Implement Demo Mode toggle in dashboard
- [ ] Wire POST /demo/activate endpoint
- [ ] Full E2E test: enroll → score → verify high trust
- [ ] Switch user test: verify score drop → lock overlay fires
- [ ] Verify SHAP breakdown shows correct trigger feature
- [ ] Verify lock fires within 2 scoring windows (≤ 10 s)

### Chunk 8.2 — Polish + Demo Prep
- [ ] Handle idle user (no events >5 s) — maintain score, show idle
- [ ] Handle single-input mode — degrade gracefully
- [ ] Handle rapid tab switching — pause/resume
- [ ] Performance audit: 60 Hz no dropped frames
- [ ] WebSocket backpressure handling
- [ ] Scoring completes within 500 ms
- [ ] Create demo script / runbook for April 17
- [ ] Write README.md with full setup instructions
- [ ] Final commit and push

---

## Summary

| Day | Date     | Focus                              | Chunks |
|-----|----------|------------------------------------|--------|
| 1   | April 9  | Scaffolding + Mouse collector      | 2      |
| 2   | April 10 | Key/scroll + WebSocket backend     | 2      |
| 3   | April 11 | Pipeline E2E + mouse features      | 2      |
| 4   | April 12 | All features + Isolation Forest    | 2      |
| 5   | April 13 | Scoring + persistence              | 2      |
| 6   | April 14 | SHAP + dashboard start             | 2      |
| 7   | April 15 | Dashboard complete                 | 2      |
| 8   | April 16 | Integration + demo + polish        | 2      |
|     |          | **Total**                          | **16** |
