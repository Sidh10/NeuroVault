# NeuroVault — Phase 1: BLUEPRINT

> Pre-code verification document. Every question answered. Every contract locked.
> Created: April 9, 2026

---

## 1. Data Flow — Exact Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                        │
│                                                                             │
│  ┌──────────────────────────────────────────────┐                           │
│  │           neurovault.js (Collector)           │                           │
│  │                                               │                          │
│  │  document.addEventListener("mousemove")  ────►│                          │
│  │  document.addEventListener("keydown")    ────►│ Event Buffer             │
│  │  document.addEventListener("keyup")      ────►│ (in-memory array)        │
│  │  document.addEventListener("scroll")     ────►│                          │
│  │                                               │                          │
│  │  setInterval(100ms) ──► _flushBatch() ────────┤                          │
│  │                              │                │                          │
│  │                    TelemetryBatch JSON         │                          │
│  │                              │                │                          │
│  └──────────────────────────────┼────────────────┘                          │
│                                 │                                           │
│                    WebSocket.send(JSON.stringify)                            │
│                                 │                                           │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                    ws://localhost:8000/ws
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FastAPI BACKEND                                      │
│                                                                             │
│  ┌──────────────────────────────────────────────┐                           │
│  │         ws/handler.py — websocket_endpoint    │                          │
│  │                                               │                          │
│  │  1. websocket.accept()                        │                          │
│  │  2. websocket.receive_text()                  │                          │
│  │  3. Parse → TelemetryBatch (Pydantic)         │                          │
│  │  4. Store raw batch in SQLite                 │                          │
│  │  5. Route based on enrollment state:          │                          │
│  │     ├─ NOT ENROLLED → handle_enrollment()     │                          │
│  │     └─ ENROLLED ──→ handle_scoring()          │                          │
│  └──────────────┬───────────────┬────────────────┘                          │
│                 │               │                                           │
│         ┌───────▼──────┐  ┌────▼──────────────┐                             │
│         │ Enrollment   │  │ Scoring Path      │                             │
│         │ Path         │  │                   │                             │
│         └───────┬──────┘  └────┬──────────────┘                             │
│                 │              │                                            │
│                 ▼              ▼                                            │
│  ┌──────────────────────────────────────────────┐                           │
│  │    engine/feature_extractor.py                │                          │
│  │                                               │                          │
│  │  extract_features(batch) → np.ndarray(15,)    │                          │
│  │    ├─ extract_mouse_features()    → 6 floats  │                          │
│  │    ├─ extract_keystroke_features() → 5 floats │                          │
│  │    └─ extract_scroll_features()   → 4 floats  │                          │
│  └──────────────────────┬───────────────────────┘                           │
│                         │                                                   │
│                   feature vector                                            │
│                     np.ndarray                                              │
│                         │                                                   │
│         ┌───────────────┼──────────────────┐                                │
│         │               │                  │                                │
│         ▼               ▼                  │                                │
│  ┌──────────────┐ ┌──────────────────┐     │                                │
│  │ Enrollment:  │ │ Scoring:         │     │                                │
│  │ Accumulate   │ │ isolation_forest │     │                                │
│  │ 36 windows   │ │ .score()         │     │                                │
│  │ then train   │ │    │             │     │                                │
│  │ IsolationFor │ │    ▼             │     │                                │
│  │ est model    │ │ trust_score      │     │                                │
│  │              │ │ (0.0 – 100.0)    │     │                                │
│  └──────────────┘ └────────┬─────────┘     │                                │
│                            │               │                                │
│                            ▼               │                                │
│                  ┌─────────────────────┐    │                                │
│                  │ shap_explainer.py   │    │                                │
│                  │                     │    │                                │
│                  │ explain(model,      │    │                                │
│                  │   features,         │    │                                │
│                  │   background_data)  │    │                                │
│                  │        │            │    │                                │
│                  │        ▼            │    │                                │
│                  │ List[ShapFeature]   │    │                                │
│                  │ (top 5, humanized)  │    │                                │
│                  └────────┬────────────┘    │                                │
│                           │                │                                │
│                           ▼                │                                │
│                 ┌──────────────────────┐    │                                │
│                 │ TrustScoreResponse   │    │                                │
│                 │ {                    │    │                                │
│                 │   score,             │    │                                │
│                 │   is_anomaly,        │    │                                │
│                 │   shap_features,     │    │                                │
│                 │   timestamp          │    │                                │
│                 │ }                    │    │                                │
│                 └──────────┬───────────┘    │                                │
│                            │               │                                │
└────────────────────────────┼───────────────┘                                │
                             │                                                │
               websocket.send_text(JSON)                                      │
                             │                                                │
                             ▼                                                │
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REACT DASHBOARD                                      │
│                                                                             │
│  ┌───────────────────────────────────────────────┐                          │
│  │         useWebSocket.js (hook)                 │                         │
│  │  onmessage → parse JSON                       │                         │
│  │    ├─ EnrollmentStatus → EnrollmentProgress    │                         │
│  │    └─ TrustScoreResponse → useTrustScore       │                         │
│  └───────────────────┬───────────────────────────┘                          │
│                      │                                                      │
│                      ▼                                                      │
│  ┌──────────────────────────────────────────────┐                           │
│  │              useTrustScore.js (hook)          │                          │
│  │  Maintains:                                   │                          │
│  │    • currentScore (latest trust score)        │                          │
│  │    • scoreHistory (rolling 60s array)         │                          │
│  │    • shapFeatures (latest top 5)              │                          │
│  │    • isLocked (2 consecutive anomalies)       │                          │
│  │    • lockTriggerFeature (SHAP description)    │                          │
│  └───────────────────┬──────────────────────────┘                           │
│                      │                                                      │
│          ┌───────────┼──────────┬────────────┐                              │
│          ▼           ▼          ▼            ▼                              │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐              │
│  │ TrustScore │ │ Live     │ │ Shap     │ │ SessionLock     │              │
│  │ Ring       │ │ Graph    │ │ Breakdown│ │ Overlay         │              │
│  │ (SVG arc)  │ │(Recharts)│ │ (list)   │ │ (full viewport) │              │
│  └────────────┘ └──────────┘ └──────────┘ └─────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary (7 hops)

| Hop | From → To | Transport | Latency Budget |
|-----|-----------|-----------|---------------|
| 1 | DOM events → Collector buffer | addEventListener | < 1 ms |
| 2 | Buffer → `_flushBatch()` | setInterval(100ms) | 100 ms |
| 3 | Collector → FastAPI | WebSocket `send()` | < 10 ms (localhost) |
| 4 | Handler → `extract_features()` | function call | < 5 ms |
| 5 | Features → `score()` + `explain()` | function call | < 500 ms |
| 6 | Response → WebSocket client | WebSocket `send_text()` | < 10 ms |
| 7 | Hook → React re-render | setState | < 16 ms (1 frame) |
| | **Total end-to-end** | | **< 5000 ms** (window-aligned) |

---

## 2. JSON Schemas — Exact Contracts

### 2a. Client → Server: TelemetryBatch

```json
{
  "user_id": "sidh10",
  "session_id": "a3f1c9e7-4b2d-4f8a-9c1e-7d3b5a2f8e4c",
  "batch_seq": 42,
  "timestamp": 1744147200000,
  "events": [
    {
      "type": "mousemove",
      "x": 512.0,
      "y": 384.0,
      "dx": 2.3,
      "dy": -1.1,
      "t": 1744147200012
    },
    {
      "type": "keydown",
      "key": "a",
      "t": 1744147200050,
      "flight_time": 87.3,
      "dwell_time": null
    },
    {
      "type": "keyup",
      "key": "a",
      "t": 1744147200120,
      "flight_time": null,
      "dwell_time": 70.0
    },
    {
      "type": "scroll",
      "delta_y": -120.0,
      "velocity": 0.45,
      "t": 1744147200200
    }
  ]
}
```

**Schema rules:**
- `user_id` — non-empty string, set by collector constructor
- `session_id` — UUID v4, auto-generated per collector start
- `batch_seq` — integer, starts at 0, increments by 1 per batch per session
- `timestamp` — Unix milliseconds at batch creation
- `events` — array of 0+ events; empty batches are valid (heartbeat)
- Each event has `type` as discriminator and `t` as Unix ms timestamp
- `flight_time` — only present on `keydown`, null on `keyup`
- `dwell_time` — only present on `keyup`, null on `keydown`

### 2b. Server → Client: TrustScoreResponse

```json
{
  "type": "trust_score",
  "user_id": "sidh10",
  "session_id": "a3f1c9e7-4b2d-4f8a-9c1e-7d3b5a2f8e4c",
  "score": 92.4,
  "is_anomaly": false,
  "shap_features": [
    {
      "feature_name": "mouse_avg_jitter",
      "value": 1.82,
      "contribution": -0.03,
      "direction": "authentic",
      "description": "Your cursor micro-tremor is consistent with your baseline"
    },
    {
      "feature_name": "key_avg_flight_time",
      "value": 94.5,
      "contribution": -0.02,
      "direction": "authentic",
      "description": "Your typing rhythm matches your enrolled pattern"
    },
    {
      "feature_name": "mouse_speed_std",
      "value": 0.34,
      "contribution": 0.01,
      "direction": "anomalous",
      "description": "Your cursor speed variability is slightly higher than usual"
    },
    {
      "feature_name": "scroll_avg_velocity",
      "value": 0.22,
      "contribution": -0.01,
      "direction": "authentic",
      "description": "Your scroll speed is within normal range"
    },
    {
      "feature_name": "key_typing_speed",
      "value": 5.2,
      "contribution": -0.005,
      "direction": "authentic",
      "description": "Your typing speed matches your profile"
    }
  ],
  "scoring_window_sec": 5.0,
  "timestamp": 1744147205000
}
```

**Schema rules:**
- `type` — always `"trust_score"` (discriminator for client message routing)
- `score` — float, clamped 0.0–100.0
- `is_anomaly` — `true` when `score < 50.0`
- `shap_features` — exactly 5 items, sorted by `|contribution|` descending
- `contribution` — positive = pushes toward anomaly, negative = pushes toward authentic
- `direction` — derived from sign of contribution
- `description` — complete English sentence, never raw numbers

### 2c. Server → Client: EnrollmentStatus

```json
{
  "type": "enrollment_status",
  "user_id": "sidh10",
  "is_enrolled": false,
  "windows_collected": 14,
  "windows_required": 36,
  "elapsed_seconds": 70.0,
  "status": "collecting"
}
```

**Schema rules:**
- `type` — always `"enrollment_status"` (discriminator)
- `status` — one of: `"collecting"` | `"training"` | `"ready"` | `"error"`
- `windows_required` — always 36 (5 s × 36 = 180 s = 3 minutes)
- When `status` becomes `"ready"`, server switches to scoring mode automatically

### 2d. Message Routing — The `type` Discriminator

Every server → client message includes a `type` field at the top level:

| `type` value | Model | When sent |
|---|---|---|
| `"enrollment_status"` | `EnrollmentStatus` | During enrollment, after each 5s window |
| `"trust_score"` | `TrustScoreResponse` | After enrollment, every 5s scoring window |

The React `useWebSocket` hook routes on this field:
```javascript
// Pseudocode — not implementation code
const msg = JSON.parse(event.data);
if (msg.type === "enrollment_status") updateEnrollment(msg);
if (msg.type === "trust_score") updateTrustScore(msg);
```

---

## 3. Python Packages — Exact Versions

```
# backend/requirements.txt — pinned versions, verified April 9, 2026

fastapi==0.135.3
uvicorn[standard]==0.44.0
websockets==16.0
pydantic==2.12.5
pydantic-settings==2.13.1
scikit-learn==1.8.0
shap==0.51.0
joblib==1.5.3
numpy==2.4.4
```

**9 packages. No GPU dependencies. No CUDA. No torch.**

| Package | Purpose | Why this version |
|---------|---------|-----------------|
| `fastapi==0.135.3` | HTTP + WebSocket server | Latest stable, Pydantic v2 native |
| `uvicorn[standard]==0.44.0` | ASGI server (includes `websockets` transport) | Latest stable |
| `websockets==16.0` | WebSocket protocol (used by uvicorn) | Latest stable, required by `uvicorn[standard]` |
| `pydantic==2.12.5` | Data validation for all JSON schemas | Latest stable v2 |
| `pydantic-settings==2.13.1` | `Settings` class with env var support | Latest stable |
| `scikit-learn==1.8.0` | `IsolationForest` anomaly detection | Latest stable, CPU-only |
| `shap==0.51.0` | `TreeExplainer` for Isolation Forest | Latest stable |
| `joblib==1.5.3` | Model serialization (save/load `.joblib`) | Latest stable |
| `numpy==2.4.4` | Numerical arrays for feature vectors | Latest stable |

---

## 4. npm Packages — Exact Versions

```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "recharts": "2.15.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "4.5.2",
    "vite": "6.3.2"
  }
}
```

**5 packages. Zero other dependencies.**

| Package | Purpose | Why this version |
|---------|---------|-----------------|
| `react@18.3.1` | UI framework | Constitution mandates React 18 |
| `react-dom@18.3.1` | DOM rendering | Matches React version |
| `recharts@2.15.3` | Line chart for live trust graph | Stable v2, React 18 compatible |
| `vite@6.3.2` | Dev server + bundler | Latest v6 stable, React 18 compatible |
| `@vitejs/plugin-react@4.5.2` | React JSX transform for Vite | v4.x is the latest compatible with Vite 6 + React 18 |

> **Why not Vite 8 / React 19?** The constitution specifies "React 18 + Vite". Vite 8 + plugin-react 6.x requires Node 20.19+ and is optimized for React 19. We use Vite 6 + React 18 for stability. Zero risk of peer dependency conflicts on demo day.

---

## 5. GPU Confirmation

### Does the Isolation Forest require a GPU?

## **NO.**

**scikit-learn is CPU-only. Confirmed.**

| Fact | Detail |
|------|--------|
| Library | scikit-learn 1.8.0 |
| Algorithm | `sklearn.ensemble.IsolationForest` |
| Compute backend | NumPy + Cython (CPU only) |
| GPU support | None. scikit-learn has no CUDA, no ROCm, no Metal backend |
| Parallelism | `n_jobs` parameter for multi-core CPU (we use `n_jobs=1` — single core is sufficient for 15 features × 100 trees) |
| Training time | < 100 ms for 36 samples × 15 features |
| Scoring time | < 5 ms for 1 sample × 15 features |
| SHAP backend | `shap.TreeExplainer` — also CPU-only, uses tree structure directly |

**No GPU, no CUDA, no large model downloads. The entire backend runs on a laptop CPU.**

---

## 6. Single Most Likely Integration Failure Point

### **The SHAP TreeExplainer + IsolationForest compatibility boundary**

#### Why this is the riskiest point

1. **SHAP version sensitivity**: `shap.TreeExplainer` must understand the internal tree structure of scikit-learn's `IsolationForest`. When either library updates, the internal `tree_` attribute format can change. A mismatch produces cryptic errors like `IndexError` on tree node arrays or `TypeError` on `decision_function` wrappers.

2. **Small training set**: We train on only 36 samples (3 min × 1 window/5s). SHAP's `TreeExplainer` uses a background dataset to compute expected values. With 36 samples, SHAP values can be noisy or degenerate (all values near zero), making the explainability panel useless.

3. **Contamination parameter conflict**: `IsolationForest(contamination=0.1)` means 10% of training data is expected to be outliers. With 36 samples, that's ~3.6 samples marked as contamination. If the user's behavior is consistent during enrollment, those 3 "outlier" windows may just be natural variance, skewing the model.

#### Phase 2 mitigation plan

```
Day 4, Chunk 4.2 — Immediately after IsolationForest trains:

1. SMOKE TEST: Instantiate shap.TreeExplainer(model) with the 
   trained IsolationForest. If it throws, we catch it here — 
   before any dashboard work begins.

2. SANITY CHECK: Run explain() on one training sample. 
   Verify that:
   • len(shap_values) == 15 (matches FEATURE_NAMES)
   • At least 3 of 15 features have |shap_value| > 0.001
   • _humanize_feature() produces a non-empty string for each
   If any of these fail, log a WARNING and fall back to a 
   feature-importance ranking from the model itself 
   (model.feature_importances_ via permutation importance).

3. FALLBACK: If TreeExplainer is fundamentally broken with 
   IsolationForest in shap 0.51.0, switch to shap.KernelExplainer 
   (model-agnostic, slower but guaranteed to work). 
   Budget: 200ms per explanation — still within 500ms budget.

4. THRESHOLD VALIDATION: After enrollment, score the 
   enrolled user's own training data. All 36 windows must 
   score > 75. If not, adjust contamination downward (0.05) 
   and retrain. This catches the small-sample contamination 
   issue before the dashboard ever sees bad scores.
```

#### Why the other candidates are lower risk

| Candidate | Risk level | Why lower |
|-----------|-----------|-----------|
| WebSocket connection drops | Medium | Exponential backoff is well-understood; reconnect is trivial |
| Feature extractor NaN/Inf | Medium | Guarded by zero-event checks returning zeros; unit tests cover edge cases |
| React rendering lag | Low | Only 5 components, no complex state; Recharts handles its own rendering |
| 60 Hz collector throttling | Low | `requestAnimationFrame` + timestamp delta is a solved pattern |

---

## Pre-Code Checklist

- [x] Data flow drawn — 7 hops, browser to dashboard, all transports identified
- [x] TelemetryBatch JSON schema defined with example payload
- [x] TrustScoreResponse JSON schema defined with example payload
- [x] EnrollmentStatus JSON schema defined with example payload
- [x] Message routing discriminator (`type` field) specified
- [x] 9 Python packages pinned to exact versions
- [x] 5 npm packages pinned to exact versions
- [x] GPU confirmation: **NO** — scikit-learn is CPU-only
- [x] Integration failure point identified: SHAP × IsolationForest boundary
- [x] Mitigation plan: smoke test, sanity check, fallback, threshold validation

---

**Blueprint complete. Ready for Phase 2: feature code.**
