import numpy as np
from typing import List, Dict, Any

FEATURE_NAMES = [
    "mouse_speed_mean",
    "mouse_speed_std",
    "mouse_accel_mean",
    "direction_change_rate",
    "flight_time_mean",
    "flight_time_std",
    "keystroke_interval_mean",
    "keystroke_interval_std",
    "scroll_velocity_mean",
    "scroll_burst_count",
    "pause_frequency",
    "movement_entropy"
]

def extract_features(events: List[Dict[str, Any]]) -> np.ndarray:
    if not events:
        return np.zeros(len(FEATURE_NAMES), dtype=float)
        
    events = sorted(events, key=lambda e: e.get("timestamp_ms", 0))
    
    mouse_events = [e for e in events if e.get("type") in ("mouse", "mousemove")]
    key_events = [e for e in events if e.get("type") in ("key", "keydown", "keyup")]
    scroll_events = [e for e in events if e.get("type") == "scroll"]
    
    features = {name: 0.0 for name in FEATURE_NAMES}
    
    # 1. Mouse features
    if len(mouse_events) >= 2:
        speeds = []
        accels = []
        dir_changes = 0
        angles = []
        
        for i in range(1, len(mouse_events)):
            e1 = mouse_events[i-1]
            e2 = mouse_events[i]
            dt = max(1, e2.get("timestamp_ms", 0) - e1.get("timestamp_ms", 0))
            dx = e2.get("dx", 0.0)
            dy = e2.get("dy", 0.0)
            speed = np.sqrt(dx**2 + dy**2) / dt
            speeds.append(speed)
            
            # Direction change
            if i > 1:
                e0 = mouse_events[i-2]
                if (e1.get("dx", 0) * dx < 0) or (e1.get("dy", 0) * dy < 0):
                    dir_changes += 1
            
            # Acceleration
            if i > 1:
                accels.append((speed - speeds[-2]) / dt)
            
            if dx != 0 or dy != 0:
                angles.append(np.arctan2(dy, dx))
                
        features["mouse_speed_mean"] = float(np.mean(speeds)) if speeds else 0.0
        features["mouse_speed_std"] = float(np.std(speeds)) if len(speeds) > 1 else 0.0
        features["mouse_accel_mean"] = float(np.mean(accels)) if accels else 0.0
        
        window_duration = max(1, events[-1].get("timestamp_ms", 0) - events[0].get("timestamp_ms", 0)) / 1000.0
        features["direction_change_rate"] = dir_changes / window_duration if window_duration > 0 else 0.0
        
        if angles:
            hist, _ = np.histogram(angles, bins=8, range=(-np.pi, np.pi))
            p = hist / np.sum(hist)
            p = p[p > 0]
            features["movement_entropy"] = float(-np.sum(p * np.log2(p)))
            
    # 2. Keystroke features
    if key_events:
        flight_times = [e["flight_time_ms"] for e in key_events if "flight_time_ms" in e]
        if flight_times:
            features["flight_time_mean"] = float(np.mean(flight_times))
            features["flight_time_std"] = float(np.std(flight_times)) if len(flight_times) > 1 else 0.0
            
        intervals = []
        for i in range(1, len(key_events)):
            intervals.append(key_events[i].get("timestamp_ms", 0) - key_events[i-1].get("timestamp_ms", 0))
        if intervals:
            features["keystroke_interval_mean"] = float(np.mean(intervals))
            features["keystroke_interval_std"] = float(np.std(intervals)) if len(intervals) > 1 else 0.0
            
    # 3. Scroll features
    if scroll_events:
        velocities = [e.get("velocity", 0.0) for e in scroll_events]
        features["scroll_velocity_mean"] = float(np.mean(velocities)) if velocities else 0.0
        
        bursts = 0
        if len(scroll_events) > 0:
            bursts = 1
            for i in range(1, len(scroll_events)):
                if scroll_events[i].get("timestamp_ms", 0) - scroll_events[i-1].get("timestamp_ms", 0) > 200:
                    bursts += 1
        features["scroll_burst_count"] = float(bursts)
        
    # 4. Global feature (pause frequency)
    pauses = 0
    for i in range(1, len(events)):
        if events[i].get("timestamp_ms", 0) - events[i-1].get("timestamp_ms", 0) > 500:
            pauses += 1
    
    window_duration = max(1, events[-1].get("timestamp_ms", 0) - events[0].get("timestamp_ms", 0)) / 1000.0
    features["pause_frequency"] = pauses / window_duration if window_duration > 0 else 0.0

    return np.array([features[name] for name in FEATURE_NAMES], dtype=float)

if __name__ == "__main__":
    import time
    now = int(time.time() * 1000)
    fake_events = []
    
    # 30 mouse events
    for i in range(30):
        fake_events.append({
            "type": "mouse",
            "timestamp_ms": now + i * 16,
            "x": 100 + i * 2,
            "y": 200 + i * 3,
            "dx": 2.0 + (i % 3) * 0.5,
            "dy": 3.0 - (i % 2) * 1.0
        })
        
    # 10 key events
    for i in range(10):
        fake_events.append({
            "type": "key",
            "timestamp_ms": now + 500 + i * 150,
            "key": "a",
            "flight_time_ms": 70.0 + (i % 4) * 10.0
        })
        
    # 10 scroll events
    for i in range(10):
        fake_events.append({
            "type": "scroll",
            "timestamp_ms": now + 1000 + i * 30 + (0 if i < 5 else 300), 
            "scroll_delta": -100.0,
            "velocity": 3.3
        })
        
    features = extract_features(fake_events)
    print("Extracted Features Vector (12 features):")
    for name, val in zip(FEATURE_NAMES, features):
        print(f"  {name}: {val:.4f}")
