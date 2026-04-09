/**
 * NeuroVault — Telemetry Collector
 * 
 * Zero-dependency vanilla JS class that captures behavioral biometric signals:
 * - Mouse movement at 60Hz via requestAnimationFrame
 * - Keystroke flight times (keydown → keyup duration)
 * - Scroll velocity and burst patterns
 * 
 * Batches events every 100ms and streams over WebSocket.
 * 
 * Usage:
 *   const collector = new NeuroCollector("ws://localhost:8000/ws/collect/SESSION_ID");
 *   collector.setSessionId("user-abc-123");
 *   collector.start();
 *   // ... later ...
 *   collector.stop();
 *   console.log(collector.getStats());
 */
class NeuroCollector {

  /**
   * @param {string} wsUrl — WebSocket server URL
   */
  constructor(wsUrl) {
    this._wsUrl = wsUrl;
    this._ws = null;
    this._running = false;
    this._sessionId = null;
    this._startTime = null;

    // ── Event buffer (flushed every 100ms) ──
    this._eventBuffer = [];

    // ── Mouse state ──
    this._rawMouseX = 0;
    this._rawMouseY = 0;
    this._lastSampledX = 0;
    this._lastSampledY = 0;
    this._mouseMovedThisFrame = false;
    this._firstMouseSample = true;
    this._rafId = null;

    // ── Key state ──
    this._keyDownMap = new Map(); // key → timestamp_ms

    // ── Scroll state ──
    this._lastScrollTime = 0;

    // ── Counters ──
    this._mouseCount = 0;
    this._keyCount = 0;
    this._scrollCount = 0;

    // ── Batch flush interval ──
    this._batchInterval = null;
    this._batchSeq = 0;

    // ── Reconnection ──
    this._reconnectAttempts = 0;
    this._maxReconnectDelay = 5000;
    this._reconnectTimer = null;

    // ── Bound handlers (for clean removal) ──
    this._boundMouseMove = this._onMouseMoveRaw.bind(this);
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);
    this._boundWheel = this._onWheel.bind(this);
    this._boundAnimLoop = this._animationLoop.bind(this);

    // ── Optional callbacks ──
    this.onBatchSent = null;    // (batch) => void
    this.onRawEvent = null;     // (event) => void
    this.onConnectionChange = null; // (state) => void
  }

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════

  /**
   * Set the session ID for batch metadata.
   * @param {string} id
   */
  setSessionId(id) {
    this._sessionId = id;
  }

  /**
   * Attach event listeners, open WebSocket, start rAF loop + batch interval.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._startTime = Date.now();
    this._batchSeq = 0;

    if (!this._sessionId) {
      this._sessionId = this._generateSessionId();
    }

    // Attach DOM listeners
    document.addEventListener('mousemove', this._boundMouseMove, { passive: true });
    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    document.addEventListener('wheel', this._boundWheel, { passive: true });

    // Start rAF loop for 60Hz mouse sampling
    this._rafId = requestAnimationFrame(this._boundAnimLoop);

    // Start 100ms batch flush
    this._batchInterval = setInterval(() => this._flushBatch(), 100);

    // Connect WebSocket
    this._connect();
  }

  /**
   * Detach all listeners, close WebSocket, stop loops.
   */
  stop() {
    if (!this._running) return;
    this._running = false;

    // Remove DOM listeners
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('keydown', this._boundKeyDown);
    document.removeEventListener('keyup', this._boundKeyUp);
    document.removeEventListener('wheel', this._boundWheel);

    // Stop rAF loop
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Stop batch flush
    if (this._batchInterval !== null) {
      clearInterval(this._batchInterval);
      this._batchInterval = null;
    }

    // Stop reconnection
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Close WebSocket
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }

    // Clear key tracking state
    this._keyDownMap.clear();
  }

  /**
   * Returns collector health & statistics.
   * @returns {{ mouse_count: number, key_count: number, scroll_count: number, uptime_seconds: number }}
   */
  getStats() {
    const uptime = this._startTime ? (Date.now() - this._startTime) / 1000 : 0;
    return {
      mouse_count: this._mouseCount,
      key_count: this._keyCount,
      scroll_count: this._scrollCount,
      uptime_seconds: Math.round(uptime * 10) / 10,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Raw mousemove listener — only tracks latest position.
   * Actual sampling happens in the rAF loop at display refresh rate (~60Hz).
   */
  _onMouseMoveRaw(e) {
    this._rawMouseX = e.clientX;
    this._rawMouseY = e.clientY;
    this._mouseMovedThisFrame = true;
  }

  /**
   * rAF loop — samples mouse position at ~60Hz.
   * Computes dx/dy from last sampled position.
   */
  _animationLoop(_timestamp) {
    if (!this._running) return;

    if (this._mouseMovedThisFrame) {
      // Skip first sample (no previous position to compute delta from)
      if (this._firstMouseSample) {
        this._lastSampledX = this._rawMouseX;
        this._lastSampledY = this._rawMouseY;
        this._firstMouseSample = false;
      } else {
        const dx = this._rawMouseX - this._lastSampledX;
        const dy = this._rawMouseY - this._lastSampledY;

        // Only record if mouse actually moved (avoid zero-delta noise)
        if (dx !== 0 || dy !== 0) {
          const evt = {
            type: 'mouse',
            timestamp_ms: Date.now(),
            x: this._rawMouseX,
            y: this._rawMouseY,
            dx: dx,
            dy: dy,
          };
          this._eventBuffer.push(evt);
          this._mouseCount++;

          if (this.onRawEvent) this.onRawEvent(evt);
        }

        this._lastSampledX = this._rawMouseX;
        this._lastSampledY = this._rawMouseY;
      }

      this._mouseMovedThisFrame = false;
    }

    this._rafId = requestAnimationFrame(this._boundAnimLoop);
  }

  /**
   * Keydown handler — records press timestamp, ignores modifier keys.
   */
  _onKeyDown(e) {
    // Ignore modifier keys — they don't carry biometric signal
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    // Ignore repeat events (key held down)
    if (e.repeat) return;

    // Store keydown timestamp for flight_time computation
    this._keyDownMap.set(e.code, Date.now());
  }

  /**
   * Keyup handler — computes flight_time_ms from matching keydown.
   */
  _onKeyUp(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    const downTime = this._keyDownMap.get(e.code);
    if (downTime === undefined) return;

    const now = Date.now();
    const flightTime = now - downTime;
    this._keyDownMap.delete(e.code);

    const evt = {
      type: 'key',
      timestamp_ms: now,
      key: e.code,
      flight_time_ms: flightTime,
    };
    this._eventBuffer.push(evt);
    this._keyCount++;

    if (this.onRawEvent) this.onRawEvent(evt);
  }

  /**
   * Wheel handler — computes instantaneous scroll velocity.
   */
  _onWheel(e) {
    const now = Date.now();
    const timeSinceLast = now - this._lastScrollTime;
    const velocity = Math.abs(e.deltaY) / Math.max(1, timeSinceLast);

    const evt = {
      type: 'scroll',
      timestamp_ms: now,
      scroll_delta: e.deltaY,
      velocity: Math.round(velocity * 1000) / 1000, // 3 decimal places
    };
    this._eventBuffer.push(evt);
    this._scrollCount++;
    this._lastScrollTime = now;

    if (this.onRawEvent) this.onRawEvent(evt);
  }

  // ═══════════════════════════════════════════════════════════
  //  BATCHING & WEBSOCKET
  // ═══════════════════════════════════════════════════════════

  /**
   * Packages buffered events into a batch and sends via WebSocket.
   * Called every 100ms by setInterval.
   */
  _flushBatch() {
    // Always send a batch, even if empty (acts as heartbeat)
    const events = this._eventBuffer.splice(0);

    const batch = {
      session_id: this._sessionId,
      ts: Date.now(),
      batch_seq: this._batchSeq++,
      events: events,
    };

    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(batch));
      if (this.onBatchSent) this.onBatchSent(batch);
    }
    // If WS not open, events are lost (acceptable — we don't queue stale telemetry)
  }

  /**
   * Opens WebSocket connection.
   */
  _connect() {
    if (this._ws) {
      this._ws.close();
    }

    this._emitConnectionChange('connecting');

    try {
      this._ws = new WebSocket(this._wsUrl);
    } catch (err) {
      this._emitConnectionChange('error');
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._reconnectAttempts = 0;
      this._emitConnectionChange('open');
    };

    this._ws.onclose = () => {
      this._emitConnectionChange('closed');
      if (this._running) {
        this._scheduleReconnect();
      }
    };

    this._ws.onerror = () => {
      this._emitConnectionChange('error');
    };

    this._ws.onmessage = (event) => {
      // Server responses (trust scores, enrollment status) can be handled
      // via an optional callback in the future
    };
  }

  /**
   * Reconnects with exponential backoff: 500ms, 1s, 2s, 4s, 5s max.
   */
  _scheduleReconnect() {
    if (!this._running) return;

    const delay = Math.min(
      500 * Math.pow(2, this._reconnectAttempts),
      this._maxReconnectDelay
    );
    this._reconnectAttempts++;

    this._reconnectTimer = setTimeout(() => {
      if (this._running) {
        this._connect();
      }
    }, delay);
  }

  // ═══════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════

  _emitConnectionChange(state) {
    if (this.onConnectionChange) this.onConnectionChange(state);
  }

  _generateSessionId() {
    // Simple UUID v4 generator (no crypto dependency needed)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
