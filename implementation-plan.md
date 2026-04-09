# NeuroVault — Implementation Plan

> This document defines the exact file structure, every module, every function signature, and the data contracts. No code is written until this plan is approved.

---

## 1. Repository File Structure

```
NeuroVault/
│
├── gemini.md                         # Project constitution
├── brand-guidelines.md               # Visual identity spec
├── task-plan.md                      # 8-day task breakdown
├── implementation-plan.md            # This file
├── progress-tracker.md               # Checkbox tracker
├── README.md                         # Setup + run instructions (Day 8)
├── .gitignore
│
├── collector/
│   ├── neurovault.js                 # Zero-dependency telemetry collector
│   └── test-harness.html            # Browser test page for collector
│
├── backend/
│   ├── requirements.txt             # Python dependencies
│   ├── main.py                      # FastAPI entry point
│   ├── config.py                    # App settings (ports, thresholds, paths)
│   ├── db.py                        # SQLite init + connection helper
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py               # Pydantic models (telemetry, scores, SHAP)
│   │
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── feature_extractor.py     # Raw events → feature vectors
│   │   ├── isolation_forest.py      # Enrollment + anomaly scoring
│   │   ├── shap_explainer.py        # SHAP → human-readable explanations
│   │   └── profile_manager.py       # Model persistence (joblib + SQLite)
│   │
│   ├── ws/
│   │   ├── __init__.py
│   │   └── handler.py               # WebSocket endpoint + session management
│   │
│   ├── demo/
│   │   └── demo_profile.json        # Pre-saved profile for demo mode
│   │
│   └── tests/
│       ├── __init__.py
│       ├── test_feature_extractor.py
│       ├── test_isolation_forest.py
│       └── test_shap_explainer.py
│
└── dashboard/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    │
    ├── public/
    │   └── favicon.svg
    │
    └── src/
        ├── main.jsx                  # React DOM entry
        ├── App.jsx                   # Root component + layout
        ├── index.css                 # CSS variables + global styles
        │
        ├── components/
        │   ├── TrustScoreRing.jsx    # SVG arc score display
        │   ├── LiveGraph.jsx         # Recharts rolling line chart
        │   ├── ShapBreakdown.jsx     # Top-5 SHAP feature panel
        │   ├── SessionLockOverlay.jsx# Full-screen intruder alert
        │   ├── EnrollmentProgress.jsx# 3-min enrollment progress bar
        │   └── StatusIndicator.jsx   # Connection + mode indicator
        │
        ├── hooks/
        │   ├── useWebSocket.js       # WebSocket connection management
        │   └── useTrustScore.js      # Score state + history management
        │
        └── utils/
            └── constants.js          # Brand colors, thresholds, config
```

**Total files: 35** (including planning docs and config)

---

## 2. Module Specifications

### 2.1 Collector — `collector/neurovault.js`

Zero-dependency vanilla JS class. Attaches to `document` events, batches at 100 ms, streams over native WebSocket.

```javascript
class NeuroVaultCollector {

  /**
   * @param {Object} options
   * @param {string} options.wsUrl       - WebSocket server URL (e.g. "ws://localhost:8000/ws")
   * @param {string} options.userId      - Unique user identifier
   * @param {string} options.sessionId   - Session UUID (auto-generated if omitted)
   * @param {number} options.batchIntervalMs - Flush interval in ms (default: 100)
   * @param {function} options.onConnectionChange - Callback(state: string)
   * @param {function} options.onScoreUpdate      - Callback(TrustScoreResponse)
   */
  constructor(options) {}

  // ── Event Handlers ──────────────────────────────────────────

  /** Captures mouse position at 60 Hz. Computes dx, dy from previous. */
  _onMouseMove(event: MouseEvent): void {}

  /** Records keydown timestamp. Computes flight_time from last keyup. */
  _onKeyDown(event: KeyboardEvent): void {}

  /** Records keyup timestamp. Computes dwell_time. */
  _onKeyUp(event: KeyboardEvent): void {}

  /** Captures scroll delta and computes instantaneous velocity. */
  _onScroll(event: Event): void {}

  // ── Batching ────────────────────────────────────────────────

  /** Packages current event buffer into TelemetryBatch, sends via WS. */
  _flushBatch(): void {}

  // ── WebSocket ───────────────────────────────────────────────

  /** Opens WebSocket connection to wsUrl. */
  _connect(): void {}

  /** Reconnects with exponential backoff: 500ms, 1s, 2s, 4s, 5s max. */
  _reconnect(): void {}

  /** Handles incoming TrustScoreResponse from server. */
  _onMessage(data: string): void {}

  // ── Public API ──────────────────────────────────────────────

  /** Attaches all event listeners, starts batch interval, connects WS. */
  start(): void {}

  /** Detaches listeners, stops interval, closes WS. */
  stop(): void {}

  /** Returns collector health stats. */
  getStats(): {
    eventsCollected: number,
    batchesSent: number,
    connectionState: "connecting" | "open" | "closed" | "error",
    lastBatchTimestamp: number
  } {}
}
```

### 2.2 Backend Models — `backend/models/schemas.py`

Pydantic v2 models that define every data shape in the system.

```python
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Union
from uuid import uuid4


class MouseEvent(BaseModel):
    type: Literal["mousemove"]
    x: float                          # viewport X in px
    y: float                          # viewport Y in px
    dx: float                         # delta from previous X
    dy: float                         # delta from previous Y
    t: int                            # Unix timestamp in ms


class KeyEvent(BaseModel):
    type: Literal["keydown", "keyup"]
    key: str                          # key identifier (e.g. "a", "Shift")
    t: int                            # Unix timestamp in ms
    flight_time: Optional[float] = None  # ms since last keyup (keydown only)
    dwell_time: Optional[float] = None   # ms key held (keyup only)


class ScrollEvent(BaseModel):
    type: Literal["scroll"]
    delta_y: float                    # scroll delta in px
    velocity: float                   # px/ms instantaneous
    t: int                            # Unix timestamp in ms


TelemetryEvent = Union[MouseEvent, KeyEvent, ScrollEvent]


class TelemetryBatch(BaseModel):
    user_id: str
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    batch_seq: int                    # monotonically increasing per session
    timestamp: int                    # batch creation time, Unix ms
    events: List[TelemetryEvent]


class ShapFeature(BaseModel):
    feature_name: str                 # e.g. "avg_jitter"
    value: float                      # actual measured value
    contribution: float               # SHAP value (signed)
    direction: Literal["authentic", "anomalous"]
    description: str                  # human-readable explanation


class TrustScoreResponse(BaseModel):
    user_id: str
    session_id: str
    score: float                      # 0.0 (intruder) – 100.0 (authentic)
    is_anomaly: bool                  # True if score < threshold
    shap_features: List[ShapFeature]  # top 5 by |contribution|
    scoring_window_sec: float         # window duration used
    timestamp: int                    # Unix ms


class EnrollmentStatus(BaseModel):
    user_id: str
    is_enrolled: bool
    windows_collected: int            # out of 36 required
    windows_required: int = 36        # 5s × 36 = 180s = 3 min
    elapsed_seconds: float
    status: Literal["collecting", "training", "ready", "error"]
```

### 2.3 Backend Config — `backend/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Telemetry
    BATCH_INTERVAL_MS: int = 100
    SCORING_WINDOW_SEC: float = 5.0
    ENROLLMENT_WINDOWS_REQUIRED: int = 36      # 36 × 5s = 3 min

    # Isolation Forest
    IF_N_ESTIMATORS: int = 100
    IF_CONTAMINATION: float = 0.1
    IF_RANDOM_STATE: int = 42

    # Scoring
    ANOMALY_THRESHOLD: float = 50.0            # score below this = anomaly
    LOCK_CONSECUTIVE_ANOMALIES: int = 2        # lock after N consecutive

    # Persistence
    DB_PATH: str = "neurovault.db"
    PROFILES_DIR: str = "profiles"
    DEMO_PROFILE_PATH: str = "demo/demo_profile.json"

    # SHAP
    SHAP_TOP_K: int = 5

    class Config:
        env_prefix = "NV_"
```

### 2.4 Database — `backend/db.py`

```python
import sqlite3
from contextlib import contextmanager

def init_db(db_path: str) -> None:
    """Creates tables if not exist: sessions, telemetry_batches, profiles."""

@contextmanager
def get_connection(db_path: str):
    """Yields a sqlite3.Connection with row_factory = sqlite3.Row."""
```

**Tables:**

```sql
CREATE TABLE IF NOT EXISTS sessions (
    session_id   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    started_at   INTEGER NOT NULL,
    ended_at     INTEGER,
    status       TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS telemetry_batches (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL,
    batch_seq    INTEGER NOT NULL,
    payload      TEXT NOT NULL,          -- JSON blob
    received_at  INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id      TEXT PRIMARY KEY,
    model_path   TEXT NOT NULL,          -- joblib file path
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    window_count INTEGER NOT NULL,
    feature_names TEXT NOT NULL           -- JSON array
);
```

### 2.5 Feature Extractor — `backend/engine/feature_extractor.py`

```python
import numpy as np
from typing import List, Dict
from models.schemas import MouseEvent, KeyEvent, ScrollEvent, TelemetryBatch

# Ordered list — must match model training order
FEATURE_NAMES: List[str] = [
    # Mouse (4)
    "mouse_speed_mean",
    "mouse_speed_std",
    "mouse_accel_mean",
    "direction_change_rate",
    # Keystroke (4)
    "flight_time_mean",
    "flight_time_std",
    "keystroke_interval_mean",
    "keystroke_interval_std",
    # Scroll & Meta (4)
    "scroll_velocity_mean",
    "scroll_burst_count",
    "pause_frequency",
    "movement_entropy"
]  # 12 features total


def extract_mouse_features(events: List[MouseEvent]) -> Dict[str, float]:
    """
    Returns dict with keys:
    mouse_speed_mean, mouse_speed_std, mouse_accel_mean, direction_change_rate
    Returns zeros if fewer than 3 events.
    """


def extract_keystroke_features(events: List[KeyEvent]) -> Dict[str, float]:
    """
    Returns dict with keys:
    flight_time_mean, flight_time_std, keystroke_interval_mean, keystroke_interval_std
    Returns zeros if fewer than 2 events.
    """


def extract_scroll_features(events: List[ScrollEvent], all_events: List[TelemetryEvent]) -> Dict[str, float]:
    """
    Returns dict with keys:
    scroll_velocity_mean, scroll_burst_count, pause_frequency, movement_entropy
    """


def extract_features(batch: TelemetryBatch) -> np.ndarray:
    """
    Combines all extractors. Returns a 1D numpy array of shape (12,)
    in the order defined by FEATURE_NAMES.
    """
```

### 2.6 Isolation Forest Engine — `backend/engine/isolation_forest.py`

```python
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Optional

class BiometricEngine:

    def __init__(
        self,
        contamination: float = 0.1,
        n_estimators: int = 100,
        random_state: int = 42,
    ) -> None:
        """Initialize engine parameters. No model until enroll() is called."""

    def begin_enrollment(self, user_id: str) -> None:
        """Start collecting feature vectors for a new enrollment."""

    def add_enrollment_window(self, user_id: str, features: np.ndarray) -> int:
        """
        Append a feature vector to enrollment buffer.
        Returns: total windows collected so far.
        """

    def complete_enrollment(self, user_id: str) -> bool:
        """
        Trains IsolationForest on collected windows.
        Returns True if training succeeded (>= 36 windows).
        Computes baseline mean/std for score normalization.
        """

    def is_enrolled(self, user_id: str) -> bool:
        """Check if user has a trained model."""

    def score(self, user_id: str, features: np.ndarray) -> float:
        """
        Score a single feature vector against enrolled model.
        Returns: trust score 0.0 – 100.0
        Uses: model.decision_function() → normalize via baseline stats.
        """

    def get_model(self, user_id: str) -> Optional[IsolationForest]:
        """Returns the trained model for SHAP analysis. None if not enrolled."""

    def get_baseline(self, user_id: str) -> Optional[np.ndarray]:
        """Returns the training data matrix for SHAP background. None if not enrolled."""
```

### 2.7 SHAP Explainer — `backend/engine/shap_explainer.py`

```python
import shap
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import List
from models.schemas import ShapFeature
from engine.feature_extractor import FEATURE_NAMES

class ShapExplainer:

    def __init__(self, feature_names: List[str] = FEATURE_NAMES) -> None:
        """Store feature names for mapping."""

    def explain(
        self,
        model: IsolationForest,
        features: np.ndarray,
        background_data: np.ndarray,
    ) -> List[ShapFeature]:
        """
        Compute SHAP values for a single feature vector.
        Returns top-K ShapFeature objects sorted by |contribution|.
        Uses shap.TreeExplainer with background_data as reference.
        """

    def _humanize_feature(
        self,
        feature_name: str,
        value: float,
        shap_value: float,
        baseline_mean: float,
        baseline_std: float,
    ) -> str:
        """
        Converts raw SHAP output to a human-readable sentence.
        Example: "Your cursor jitter is 40% steadier than your baseline"
        """


# ── Human-readable feature descriptions ─────────────────────
FEATURE_DESCRIPTIONS: dict[str, str] = {
    "mouse_avg_speed":        "Average cursor speed",
    "mouse_speed_std":        "Cursor speed variability",
    "mouse_avg_jitter":       "Cursor micro-tremor intensity",
    "mouse_jitter_std":       "Cursor tremor consistency",
    "mouse_avg_curvature":    "Cursor path curvature",
    "mouse_direction_changes":"Cursor direction reversals",
    "key_avg_flight_time":    "Time between key releases and presses",
    "key_flight_time_std":    "Typing rhythm consistency",
    "key_avg_dwell_time":     "Key hold duration",
    "key_dwell_time_std":     "Key hold consistency",
    "key_typing_speed":       "Overall typing speed",
    "scroll_avg_velocity":    "Average scroll speed",
    "scroll_velocity_std":    "Scroll speed variability",
    "scroll_frequency":       "Scroll frequency",
    "scroll_avg_distance":    "Average scroll distance",
}
```

### 2.8 Profile Manager — `backend/engine/profile_manager.py`

```python
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Tuple, List, Optional

class ProfileManager:

    def __init__(self, db_path: str = "neurovault.db", profiles_dir: str = "profiles") -> None:
        """Initialize paths, create profiles directory if needed."""

    def save_model(
        self,
        user_id: str,
        model: IsolationForest,
        training_data: np.ndarray,
        feature_names: List[str],
    ) -> str:
        """
        Serializes model + training data to disk with joblib.
        Records metadata in SQLite profiles table.
        Returns: file path of saved model.
        """

    def load_model(self, user_id: str) -> Tuple[IsolationForest, np.ndarray]:
        """
        Loads model and training data from disk.
        Raises FileNotFoundError if profile doesn't exist.
        """

    def load_demo_profile(self, demo_path: str) -> Tuple[IsolationForest, np.ndarray]:
        """Loads the pre-saved demo profile from JSON/joblib."""

    def list_profiles(self) -> List[dict]:
        """Returns list of {user_id, created_at, window_count} dicts."""

    def delete_profile(self, user_id: str) -> bool:
        """Deletes model file and database record. Returns True if existed."""
```

### 2.9 WebSocket Handler — `backend/ws/handler.py`

```python
from fastapi import WebSocket, WebSocketDisconnect
from models.schemas import TelemetryBatch, TrustScoreResponse, EnrollmentStatus

async def websocket_endpoint(websocket: WebSocket) -> None:
    """
    Main WebSocket handler.
    1. Accept connection
    2. Receive TelemetryBatch messages
    3. Route to enrollment or scoring based on user state
    4. Send back TrustScoreResponse or EnrollmentStatus
    """

async def handle_enrollment(
    user_id: str,
    batch: TelemetryBatch,
) -> EnrollmentStatus:
    """
    Processes batch during enrollment phase.
    Extracts features, adds to enrollment buffer.
    Auto-completes enrollment when windows_required is reached.
    """

async def handle_scoring(
    user_id: str,
    batch: TelemetryBatch,
) -> Optional[TrustScoreResponse]:
    """
    Processes batch during scoring phase.
    Accumulates events into 5-second windows.
    Returns TrustScoreResponse at window boundaries, None otherwise.
    """
```

### 2.10 FastAPI Entry — `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NeuroVault", version="1.0.0")

# CORS for dashboard dev server
# WebSocket route: /ws
# REST routes:
#   GET  /health           → {"status": "ok"}
#   GET  /profiles          → list enrolled profiles
#   DELETE /profiles/{id}   → delete a profile
#   POST /demo/activate     → load demo profile into engine
```

---

## 3. Data Contracts — JSON Schemas

### 3.1 Client → Server: `TelemetryBatch`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TelemetryBatch",
  "description": "A batch of telemetry events sent from collector to backend every 100ms",
  "type": "object",
  "required": ["user_id", "session_id", "batch_seq", "timestamp", "events"],
  "properties": {
    "user_id": {
      "type": "string",
      "description": "Unique user identifier"
    },
    "session_id": {
      "type": "string",
      "format": "uuid",
      "description": "Session identifier, generated on collector start"
    },
    "batch_seq": {
      "type": "integer",
      "minimum": 0,
      "description": "Monotonically increasing batch sequence number"
    },
    "timestamp": {
      "type": "integer",
      "description": "Batch creation time in Unix milliseconds"
    },
    "events": {
      "type": "array",
      "items": {
        "oneOf": [
          { "$ref": "#/definitions/MouseEvent" },
          { "$ref": "#/definitions/KeyEvent" },
          { "$ref": "#/definitions/ScrollEvent" }
        ]
      }
    }
  },
  "definitions": {
    "MouseEvent": {
      "type": "object",
      "required": ["type", "x", "y", "dx", "dy", "t"],
      "properties": {
        "type":  { "const": "mousemove" },
        "x":     { "type": "number", "description": "Viewport X in px" },
        "y":     { "type": "number", "description": "Viewport Y in px" },
        "dx":    { "type": "number", "description": "Delta X from previous" },
        "dy":    { "type": "number", "description": "Delta Y from previous" },
        "t":     { "type": "integer", "description": "Unix timestamp in ms" }
      }
    },
    "KeyEvent": {
      "type": "object",
      "required": ["type", "key", "t"],
      "properties": {
        "type":        { "enum": ["keydown", "keyup"] },
        "key":         { "type": "string", "description": "Key identifier" },
        "t":           { "type": "integer", "description": "Unix timestamp in ms" },
        "flight_time": { "type": ["number", "null"], "description": "ms since last keyup (keydown only)" },
        "dwell_time":  { "type": ["number", "null"], "description": "ms key was held (keyup only)" }
      }
    },
    "ScrollEvent": {
      "type": "object",
      "required": ["type", "delta_y", "velocity", "t"],
      "properties": {
        "type":     { "const": "scroll" },
        "delta_y":  { "type": "number", "description": "Scroll delta Y in px" },
        "velocity": { "type": "number", "description": "Instantaneous velocity in px/ms" },
        "t":        { "type": "integer", "description": "Unix timestamp in ms" }
      }
    }
  }
}
```

### 3.2 Server → Client: `TrustScoreResponse`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TrustScoreResponse",
  "description": "Sent from server to client after each 5-second scoring window",
  "type": "object",
  "required": ["user_id", "session_id", "score", "is_anomaly", "shap_features", "scoring_window_sec", "timestamp"],
  "properties": {
    "user_id": {
      "type": "string"
    },
    "session_id": {
      "type": "string",
      "format": "uuid"
    },
    "score": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 100.0,
      "description": "Trust score: 0 = intruder, 100 = authentic"
    },
    "is_anomaly": {
      "type": "boolean",
      "description": "True if score < anomaly threshold (50.0)"
    },
    "shap_features": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "$ref": "#/definitions/ShapFeature"
      }
    },
    "scoring_window_sec": {
      "type": "number",
      "description": "Duration of the scoring window in seconds"
    },
    "timestamp": {
      "type": "integer",
      "description": "Scoring time in Unix milliseconds"
    }
  },
  "definitions": {
    "ShapFeature": {
      "type": "object",
      "required": ["feature_name", "value", "contribution", "direction", "description"],
      "properties": {
        "feature_name": {
          "type": "string",
          "description": "Internal feature name, e.g. 'mouse_avg_jitter'"
        },
        "value": {
          "type": "number",
          "description": "Measured value for this window"
        },
        "contribution": {
          "type": "number",
          "description": "SHAP value (positive = pushes toward anomaly)"
        },
        "direction": {
          "enum": ["authentic", "anomalous"],
          "description": "Whether this feature supports or contradicts authentication"
        },
        "description": {
          "type": "string",
          "description": "Human-readable explanation of the feature's impact"
        }
      }
    }
  }
}
```

### 3.3 Server → Client: `EnrollmentStatus`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EnrollmentStatus",
  "description": "Sent during enrollment phase to show progress",
  "type": "object",
  "required": ["user_id", "is_enrolled", "windows_collected", "windows_required", "elapsed_seconds", "status"],
  "properties": {
    "user_id":            { "type": "string" },
    "is_enrolled":        { "type": "boolean" },
    "windows_collected":  { "type": "integer", "minimum": 0 },
    "windows_required":   { "type": "integer", "default": 36 },
    "elapsed_seconds":    { "type": "number" },
    "status":             { "enum": ["collecting", "training", "ready", "error"] }
  }
}
```

---

## 4. Feature Vector Specification

The Isolation Forest operates on a **15-dimensional feature vector**, extracted per 5-second window:

| Index | Feature Name               | Unit    | Source      | Description                                   |
|-------|----------------------------|---------|-------------|-----------------------------------------------|
| 0     | `mouse_avg_speed`          | px/ms   | mousemove   | Mean Euclidean speed between consecutive moves |
| 1     | `mouse_speed_std`          | px/ms   | mousemove   | Std dev of speed — movement consistency        |
| 2     | `mouse_avg_jitter`         | px      | mousemove   | Mean perpendicular deviation from line of best fit |
| 3     | `mouse_jitter_std`         | px      | mousemove   | Std dev of jitter — tremor consistency         |
| 4     | `mouse_avg_curvature`      | radians | mousemove   | Mean angle change between movement segments    |
| 5     | `mouse_direction_changes`  | count   | mousemove   | Number of sign reversals in dx or dy           |
| 6     | `key_avg_flight_time`      | ms      | keydown/up  | Mean time from keyup to next keydown           |
| 7     | `key_flight_time_std`      | ms      | keydown/up  | Std dev — typing rhythm regularity             |
| 8     | `key_avg_dwell_time`       | ms      | keydown/up  | Mean time a key is held down                   |
| 9     | `key_dwell_time_std`       | ms      | keydown/up  | Std dev — key hold consistency                 |
| 10    | `key_typing_speed`         | keys/s  | keydown     | Keys pressed per second in window              |
| 11    | `scroll_avg_velocity`      | px/ms   | scroll      | Mean scroll velocity                           |
| 12    | `scroll_velocity_std`      | px/ms   | scroll      | Std dev — scroll smoothness                    |
| 13    | `scroll_frequency`         | Hz      | scroll      | Scroll events per second                       |
| 14    | `scroll_avg_distance`      | px      | scroll      | Mean absolute scroll delta per event           |

---

## 5. Dashboard Component Specs

### `TrustScoreRing.jsx`
- **Props**: `score: number (0–100)`
- **Visual**: SVG `<circle>` with `stroke-dasharray` for arc. 180px diameter, 12px stroke.
- **Color**: `score >= 85 → #1D9E75` | `50–84 → #EF9F27` | `< 50 → #E24B4A`
- **Animation**: CSS transition on `stroke-dashoffset`, 300ms ease (only allowed animation)
- **Score display**: `48px JetBrains Mono`, centered in ring

### `LiveGraph.jsx`
- **Props**: `history: Array<{time: number, score: number}>`, `baselineScore: 85`
- **Visual**: Recharts `<LineChart>` with dark background `#0A0A0F`
- **Lines**: Dotted `<ReferenceLine>` at y=85 (baseline), solid `<Line>` for live score
- **Window**: Rolling 60-second X-axis
- **Colors**: Line follows same color rules as ring

### `ShapBreakdown.jsx`
- **Props**: `features: Array<ShapFeature>`
- **Visual**: Vertical list. Each row: feature name, horizontal bar, description text
- **Color**: `direction === "authentic" → #1D9E75` | `"anomalous" → #E24B4A`

### `SessionLockOverlay.jsx`
- **Props**: `isLocked: boolean`, `triggerFeature: string`
- **Trigger**: `is_anomaly === true` for 2 consecutive scoring windows
- **Visual**: Full viewport, `#E24B4A` background, centered white text
- **Title**: "MOTOR MISMATCH DETECTED" — Inter 500, 32px
- **Subtitle**: The triggering SHAP feature description — 18px

### `EnrollmentProgress.jsx`
- **Props**: `status: EnrollmentStatus`
- **Visual**: Progress bar (0–180s), window count, "Learning your motor patterns…"
- **Completion**: Transitions to scoring mode when `status === "ready"`

### `StatusIndicator.jsx`
- **Props**: `connectionState: string`, `mode: string`
- **Visual**: Colored dot + label. Green=connected, Amber=reconnecting, Red=disconnected
- **Mode label**: "Enrolling" | "Monitoring" | "Locked"

---

## 6. Backend Dependencies — `requirements.txt`

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
websockets==14.*
pydantic==2.*
pydantic-settings==2.*
scikit-learn==1.6.*
shap==0.46.*
joblib==1.4.*
numpy==2.2.*
```

## 7. Dashboard Dependencies — `package.json` (partial)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.2.0"
  }
}
```

---

## 8. Critical Timing Constraints

| Constraint                        | Target             | Enforcement                         |
|-----------------------------------|--------------------|--------------------------------------|
| Collector sampling rate           | 60 Hz mouse events | `requestAnimationFrame` throttle     |
| Batch flush interval              | 100 ms             | `setInterval`                        |
| Enrollment duration               | 180 seconds        | 36 windows × 5 s                    |
| Scoring window                    | 5 seconds          | Server-side window accumulator       |
| Score visual update               | < 5 seconds        | WS push on window boundary           |
| Session lock trigger              | ≤ 10 seconds       | 2 consecutive anomalous windows      |
| SHAP computation                  | < 500 ms           | TreeExplainer with small background  |

---

## 9. Demo Mode Flow

1. User clicks "Demo Mode" in dashboard
2. Dashboard sends `POST /demo/activate` to backend
3. Backend loads `demo_profile.json` via `ProfileManager.load_demo_profile()`
4. Backend marks user as enrolled, enters scoring mode immediately
5. Enrolled user's micro-movements score 85+ (authentic)
6. A different person takes over → score drops → lock fires within 10 seconds
