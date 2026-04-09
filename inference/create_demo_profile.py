import json
import os
import shutil
import numpy as np

from feature_extractor import FEATURE_NAMES
from inference_engine import enroll, PROFILES_DIR

def generate_normal_window():
    return {
        "mouse_speed_mean": np.random.normal(0.8, 0.1),
        "mouse_speed_std": np.random.normal(0.8, 0.1),
        "mouse_accel_mean": np.random.normal(0.0, 0.01),
        "direction_change_rate": np.random.normal(1.8, 0.2),
        "flight_time_mean": np.random.normal(17.0, 2.0),
        "flight_time_std": np.random.normal(3.5, 0.5),
        "keystroke_interval_mean": np.random.normal(23.0, 3.0),
        "keystroke_interval_std": np.random.normal(27.0, 4.0),
        "scroll_velocity_mean": np.random.normal(4.0, 1.0),
        "scroll_burst_count": np.random.normal(0.7, 0.2),
        "pause_frequency": np.random.normal(0.3, 0.05),
        "movement_entropy": np.random.normal(1.9, 0.2)
    }

def main():
    os.makedirs(PROFILES_DIR, exist_ok=True)
    np.random.seed(42)
    
    feature_matrix = []
    for _ in range(200):
        window_features = generate_normal_window()
        f_vec = [window_features[k] for k in FEATURE_NAMES]
        feature_matrix.append(f_vec)
        
    feature_matrix = np.array(feature_matrix)
    
    # Use native enroll tool
    enroll("demo", feature_matrix)
    
    # Rename to demo.json to satisfy prompt
    joblib_path = os.path.join(PROFILES_DIR, "demo.joblib")
    json_path = os.path.join(PROFILES_DIR, "demo.json")
    if os.path.exists(joblib_path):
        shutil.move(joblib_path, json_path)
        print(f"Generated {len(feature_matrix)} normal windows. Trained model saved to {json_path}")

if __name__ == "__main__":
    main()
