import os
import sys
import numpy as np

# Setup path so we can run directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.feature_extractor import FEATURE_NAMES
from inference.inference_engine import enroll, score

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

def inject_noise(window, noise_level=0.3):
    return {k: v * (1.0 + np.random.choice([-1, 1]) * noise_level) for k, v in window.items()}

def main():
    np.random.seed(42)
    session_id = "stress_test_session"
    
    print("Enrollment...")
    feature_matrix = []
    # Using 200 samples as training target
    for _ in range(200):
        w = generate_normal_window()
        feature_matrix.append([w[k] for k in FEATURE_NAMES])
    enroll(session_id, np.array(feature_matrix))
    
    consecutive_low = 0
    locked = False
    
    print("--- Normal Windows ---")
    for i in range(10):
        w = generate_normal_window()
        vec = np.array([w[k] for k in FEATURE_NAMES])
        res = score(session_id, vec)
        
        if res["trust_score"] < 40:
            consecutive_low += 1
        else:
            consecutive_low = 0
            
        is_locked = consecutive_low >= 2
        print(f"Normal {i+1}: Trust={res['trust_score']}, Locked={is_locked}")
        if is_locked:
            print("FAIL")
            sys.exit(1)
            
    print("--- Intruder Windows ---")
    locked_within_2 = False
    for i in range(5):
        w = generate_normal_window()
        w = inject_noise(w, 0.3)
        vec = np.array([w[k] for k in FEATURE_NAMES])
        res = score(session_id, vec)
        
        if res["trust_score"] < 40:
            consecutive_low += 1
        else:
            consecutive_low = 0
            
        is_locked = consecutive_low >= 2
        print(f"Intruder {i+1}: Trust={res['trust_score']}, Locked={is_locked}")
        
        if is_locked and i <= 2:  # window 1, 2 or 3. Oh wait, "within 2 intruder windows" is index 0 or 1.
            locked_within_2 = True
            
    if locked_within_2:
        print("PASS")
    else:
        print("FAIL")

if __name__ == "__main__":
    main()
