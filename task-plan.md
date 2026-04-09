# NeuroVault — Task Plan

> 8 days × 2 chunks/day × 4 hours/chunk = 64 hours total
> Timeline: April 9 – April 16, 2026
> Demo day: April 17, 2026

---

## Day 1 — Wednesday, April 9
### Feature 1: Browser Telemetry Collector (start)

**Chunk 1.1 (4 hrs) — Project scaffolding + Collector skeleton**
- Initialize project repository with planning files and constitution
- Create full directory structure for collector, backend, and dashboard
- Set up Python virtual environment with `requirements.txt`
- Create `collector/neurovault.js` class skeleton with constructor, start/stop
- Implement `_onMouseMove` handler at 60 Hz sampling with timestamp
- Implement event normalization: compute `dx`, `dy` from consecutive positions
- Write `collector/test-harness.html` with a basic canvas area to verify collection
- Verify: open harness in browser, confirm console logs show normalized mouse events

**Chunk 1.2 (4 hrs) — Key + scroll capture + batching**
- Implement `_onKeyDown` and `_onKeyUp` handlers with flight-time computation
- Implement `_onScroll` handler with velocity calculation (delta / time)
- Build `_flushBatch()` — assembles events into `TelemetryBatch` JSON
- Add 100 ms `setInterval` for automatic batch flush
- Add event counters and `getStats()` method
- Verify: type, scroll, move in harness — confirm batches print to console at 100 ms

---

## Day 2 — Thursday, April 10
### Feature 1: Collector (complete) + Feature 2: WebSocket Pipeline (start)

**Chunk 2.1 (4 hrs) — Collector polish + WebSocket client**
- Add `_connect()` method using native `WebSocket` API
- Add `_reconnect()` with exponential backoff (max 5 s)
- Wire `_flushBatch()` to send via WebSocket when connected, queue when not
- Add connection state tracking (`connecting`, `open`, `closed`, `error`)
- Add `onConnectionChange` callback for UI status feedback
- Verify: start collector without backend — confirm reconnect attempts in console

**Chunk 2.2 (4 hrs) — FastAPI backend skeleton + WebSocket endpoint**
- Create `backend/main.py` with FastAPI app, CORS config, health check
- Create `backend/models/schemas.py` with Pydantic models: `MouseEvent`, `KeyEvent`, `ScrollEvent`, `TelemetryBatch`
- Create `backend/ws/handler.py` with `websocket_endpoint` accepting connections
- Parse incoming batches against `TelemetryBatch` schema, log validation errors
- Add SQLite database initialization in `backend/db.py`
- Verify: start uvicorn, connect collector, confirm batches received and parsed

---

## Day 3 — Friday, April 11
### Feature 2: WebSocket Pipeline (complete) + Feature 3: Isolation Forest (start)

**Chunk 3.1 (4 hrs) — Pipeline reliability + session management**
- Add session creation on first WebSocket connection per `user_id`
- Store raw batches in SQLite `telemetry_batches` table for replay
- Add batch sequence validation (detect dropped batches)
- Add heartbeat/ping-pong to detect stale connections
- Add graceful cleanup on WebSocket disconnect
- E2E verify: collector → WebSocket → FastAPI → SQLite roundtrip with data integrity

**Chunk 3.2 (4 hrs) — Feature extractor: mouse features**
- Create `backend/engine/feature_extractor.py`
- Implement `extract_mouse_features()`:
  - `avg_speed`, `speed_std` (px/ms between consecutive points)
  - `avg_jitter` (deviation from straight-line path)
  - `jitter_std`
  - `avg_curvature` (angle change between movement segments)
  - `direction_changes` (count of sign changes in dx/dy)
- Write unit tests with synthetic mouse data
- Verify: feed captured SQLite data → confirm feature vector output

---

## Day 4 — Saturday, April 12
### Feature 3: Isolation Forest Engine

**Chunk 4.1 (4 hrs) — Key + scroll features + combined vector**
- Implement `extract_keystroke_features()`:
  - `avg_flight_time`, `flight_time_std` (time between keyup → keydown)
  - `avg_dwell_time`, `dwell_time_std` (time key held)
  - `typing_speed` (keys per second)
- Implement `extract_scroll_features()`:
  - `avg_scroll_velocity`, `velocity_std`
  - `scroll_frequency` (scrolls per second)
  - `avg_scroll_distance`
- Implement `extract_features()` — combines all into single numpy vector
- Define `FEATURE_NAMES` list (ordered, maps to vector indices)
- Write unit tests for each extractor

**Chunk 4.2 (4 hrs) — Isolation Forest enrollment**
- Create `backend/engine/isolation_forest.py` with `BiometricEngine` class
- Implement `enroll()`:
  - Accumulate feature vectors over 3-minute enrollment window
  - Require minimum 36 windows (5 s × 36 = 3 min) before training
  - Fit `IsolationForest(contamination=0.1, n_estimators=100, random_state=42)`
  - Compute baseline statistics (mean, std per feature)
- Implement `is_enrolled()` check
- Wire enrollment into WebSocket handler — switch between enrollment and scoring mode
- Verify: collect 3 min of data, confirm model trains without error

---

## Day 5 — Sunday, April 13
### Feature 3: Isolation Forest (scoring + persistence)

**Chunk 5.1 (4 hrs) — Real-time scoring**
- Implement `score()` in `BiometricEngine`:
  - Extract features from 5-second sliding window
  - Run `decision_function()` → normalize to 0–100 trust score
  - Apply threshold: score < 50 → `is_anomaly = True`
- Add scoring loop in WebSocket handler:
  - Accumulate batches into 5-second windows
  - Call `score()` at each window boundary
  - Send `TrustScoreResponse` JSON back to client
- Tune anomaly detection threshold with self-data (should score 85+)
- Verify: enrolled user → score stays 85–100; new user → score drops below 50

**Chunk 5.2 (4 hrs) — Profile persistence + demo profile**
- Create `backend/engine/profile_manager.py`
- Implement `save_model()` — serialize model + training data with `joblib`, store path in SQLite
- Implement `load_model()` — restore from disk
- Implement `load_demo_profile()` — load from `backend/demo/demo_profile.json`
- Add profile management REST endpoints: `GET /profiles`, `DELETE /profiles/{id}`
- Generate and save a demo profile from own enrollment
- Verify: restart server → load saved profile → score correctly

---

## Day 6 — Monday, April 14
### Feature 4: SHAP Layer + Feature 5: Dashboard (start)

**Chunk 6.1 (4 hrs) — SHAP explainability**
- Create `backend/engine/shap_explainer.py`
- Implement `explain()`:
  - Use `shap.TreeExplainer` on the Isolation Forest model
  - Map SHAP values to `FEATURE_NAMES`
  - Sort by absolute contribution (descending)
  - Return top 5 features as `ShapFeature` objects
- Implement `_humanize_feature()`:
  - Convert `avg_jitter = 2.3, contribution = -0.8` → "Your cursor is 40% steadier than your baseline"
  - Human-readable descriptions for all 15 features
- Wire into scoring pipeline — every `TrustScoreResponse` includes SHAP breakdown
- Verify: trigger scoring → confirm SHAP features appear with human text

**Chunk 6.2 (4 hrs) — Dashboard scaffold + Trust Score Ring**
- Initialize React + Vite project in `dashboard/`
- Install Recharts, configure CSS variables from brand guidelines
- Set up WebSocket connection hook (`useWebSocket.js`)
- Build `TrustScoreRing.jsx`:
  - SVG arc, 180 px diameter, stroke-width 12
  - Animated transition on score change (the one allowed animation)
  - Color transitions: teal (85+) → amber (50–84) → red (<50)
  - Score number: 48 px JetBrains Mono, centered
- Verify: hardcode score → confirm ring renders per brand spec

---

## Day 7 — Tuesday, April 15
### Feature 5: Dashboard (complete)

**Chunk 7.1 (4 hrs) — Live graph + SHAP panel**
- Build `LiveGraph.jsx`:
  - Recharts line chart, dark background (#0A0A0F)
  - Dotted horizontal baseline at 85
  - Solid line for live trust score, rolling 60-second window
  - X-axis: time, Y-axis: 0–100
- Build `ShapBreakdown.jsx`:
  - Sorted list of top 5 SHAP features
  - Feature name, contribution bar, human-readable description
  - Color-coded: teal for authentic-direction, red for anomalous-direction
- Wire both to live WebSocket data via `useTrustScore.js` hook
- Verify: stream live data → confirm graph updates, SHAP panel refreshes

**Chunk 7.2 (4 hrs) — Session Lock + enrollment UI + status**
- Build `SessionLockOverlay.jsx`:
  - Full viewport, `#E24B4A` background, white text, centered
  - "MOTOR MISMATCH DETECTED" — Inter 500, 32 px
  - Sub-message: the specific SHAP feature name — 18 px
  - Triggers within 2 scoring windows (10 s) of sustained anomaly
- Build `EnrollmentProgress.jsx`:
  - Progress bar showing 0–180 seconds of enrollment
  - Feature vector count indicator
  - "Learning your motor patterns…" status text
- Build `StatusIndicator.jsx`:
  - Connection status dot (green/amber/red)
  - Current mode label (Enrolling / Monitoring / Locked)
- Verify: full dashboard renders all states correctly

---

## Day 8 — Wednesday, April 16
### Integration + Demo Mode + Polish

**Chunk 8.1 (4 hrs) — Demo mode + E2E integration**
- Implement Demo Mode toggle in dashboard:
  - Loads pre-saved profile, skips enrollment
  - Immediately enters scoring mode
- Full end-to-end integration test:
  - Start backend → open dashboard → enroll → score → verify trust stays high
  - Switch user (different person) → verify score drops → verify lock overlay fires
  - Verify SHAP breakdown shows correct trigger feature
  - Verify lock fires within 2 scoring windows (≤ 10 s)
- Fix any timing, threshold, or UI bugs found during integration

**Chunk 8.2 (4 hrs) — Polish + demo preparation**
- Edge case handling:
  - Idle user (no events for >5 s) — maintain last score, show "idle" status
  - Single input mode (mouse only, keyboard only) — degrade gracefully
  - Rapid tab switching — pause/resume collection
- Performance audit:
  - Verify 60 Hz collection does not drop frames
  - Verify WebSocket backpressure handling
  - Verify scoring completes within 500 ms
- Create demo script / runbook for April 17:
  - Step-by-step instructions for live demo
  - Fallback plan if WebSocket disconnects
  - Pre-loaded demo profile verified working
- Final README.md with setup instructions
- Final commit and push
