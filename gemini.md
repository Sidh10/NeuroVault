# NeuroVault — Project Constitution

## What this is
A browser-native behavioral biometric engine that authenticates users by learning the unique micro-temporal motor patterns of their nervous system — cursor jitter, keystroke flight times, scroll velocity — using an Isolation Forest anomaly detection model with SHAP explainability.

## The problem
In 2026, AI can spoof faces, voices, and writing. Passwords are dead. Biometrics are fakeable. There is no authentication layer that depends on the human nervous system — until now.

## Target user
Security-conscious web applications needing continuous, passive authentication without additional hardware or user friction.

## Core features (exactly 5, in build order)
1. Browser telemetry collector — captures mousemove at 60Hz, keydown/keyup flight times, scroll velocity via vanilla JS
2. WebSocket pipeline — streams batched events to FastAPI backend every 100ms
3. Isolation Forest engine — enrolls user profile in 3 minutes, scores new windows every 5 seconds
4. SHAP explainability layer — identifies exactly which micro-movements triggered any anomaly
5. Live Trust Dashboard — real-time score ring, rolling graph, SHAP breakdown, session lock overlay

## What this is NOT
- Not a Rust daemon, not OS-level HID hooks, not a mobile app
- Not a password manager, not a face recognition system
- No external paid APIs required
- No heavy deep learning training (no GPU needed)

## Tech stack (exact)
- Collector: Vanilla JS (zero dependencies), WebSocket API
- Backend: Python 3.11, FastAPI, WebSockets, scikit-learn, SHAP, joblib, SQLite
- Dashboard: React 18 + Vite, Recharts, CSS variables only
- Dev: uvicorn, npm, GitHub for version control

## Quality rules (non-negotiable)
- Every feature must work end-to-end before the next one starts
- No commits before April 5th in the repo (hackathon rule)
- Trust score must update visually within 5 seconds of anomaly
- Session lock overlay must fire within 2 scoring windows of intruder detection
- SHAP output must be human-readable text, not raw numbers
- Demo Mode must allow enrollment skip using a pre-saved profile JSON

## North star
On April 17th, a judge touches the mouse. Within 8 seconds, a full-screen red overlay reads "MOTOR MISMATCH DETECTED" with the exact feature that gave them away. That moment is the entire product.