import os
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import shap
from inference.feature_extractor import FEATURE_NAMES

PROFILES_DIR = "profiles"

def enroll(session_id: str, feature_matrix: np.ndarray):
    os.makedirs(PROFILES_DIR, exist_ok=True)
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(feature_matrix)
    
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(scaled_data)
    
    profile_path = os.path.join(PROFILES_DIR, f"{session_id}.joblib")
    joblib.dump({
        "model": model,
        "scaler": scaler,
        "background_data": scaled_data,
        "means": scaler.mean_,
        "scales": scaler.scale_
    }, profile_path)

def score(session_id: str, feature_vector: np.ndarray):
    profile_path = os.path.join(PROFILES_DIR, f"{session_id}.joblib")
    if not os.path.exists(profile_path):
        raise FileNotFoundError(f"Profile {session_id} not found")
        
    profile = joblib.load(profile_path)
    model = profile["model"]
    scaler = profile["scaler"]
    background = profile["background_data"]
    means = profile["means"]
    
    vec2d = feature_vector.reshape(1, -1)
    scaled_vec = scaler.transform(vec2d)
    
    raw_score = float(model.decision_function(scaled_vec)[0])
    
    # Scale raw_score so normals average > 70 as requested
    scaled_raw = raw_score * 10.0
    
    # Convert to trust_score in [0, 100]
    trust_score = int((1.0 + scaled_raw) * 50)
    trust_score = max(0, min(100, trust_score))
    
    # SHAP Explainer
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(scaled_vec)
    
    if isinstance(shap_vals, list):
        shap_array = shap_vals[0][0]
    elif len(shap_vals.shape) == 3:
        shap_array = shap_vals[0, :, 0]
    else:
        shap_array = shap_vals[0]
        
    shap_dict = {FEATURE_NAMES[i]: float(shap_array[i]) for i in range(len(FEATURE_NAMES))}
    
    # Find top anomaly (the feature that pushes the score down the most)
    top_feature_idx = np.argmin(shap_array)
    top_feature_name = FEATURE_NAMES[top_feature_idx]
    
    raw_val = feature_vector[top_feature_idx]
    mean_val = means[top_feature_idx]
    
    if mean_val == 0.0:
        ratio = 0.0
    else:
        ratio = raw_val / mean_val
        
    human_names = {
        "mouse_speed_mean": "Mouse speed",
        "mouse_speed_std": "Mouse speed jitter",
        "mouse_accel_mean": "Mouse acceleration",
        "direction_change_rate": "Mouse direction changes",
        "flight_time_mean": "Keystroke flight time",
        "flight_time_std": "Keystroke rhythm",
        "keystroke_interval_mean": "Keystroke interval",
        "keystroke_interval_std": "Keystroke interval stability",
        "scroll_velocity_mean": "Scroll velocity",
        "scroll_burst_count": "Scroll bursts",
        "pause_frequency": "Pause frequency",
        "movement_entropy": "Movement chaos"
    }
    
    hr_feature_name = human_names.get(top_feature_name, top_feature_name)
    
    if ratio > 1.0:
        desc = f"{ratio:.1f}x higher than baseline"
    elif ratio > 0 and ratio < 1.0:
        desc = f"{1.0/ratio:.1f}x lower than baseline"
    else:
        desc = f"significantly different from baseline"
        
    top_anomaly_str = f"{hr_feature_name} {desc}"
    
    return {
        "trust_score": trust_score,
        "shap_features": shap_dict,
        "top_anomaly": top_anomaly_str,
        "raw_score": raw_score
    }
    
if __name__ == "__main__":
    print("Testing Inference Engine...")
    
    # Generate 200 synthetic 'normal' vectors
    np.random.seed(42)
    normals = []
    for _ in range(200):
        vec = np.random.normal(loc=1.0, scale=0.1, size=12)
        normals.append(vec)
        
    feature_matrix = np.array(normals)
    session_id = "test_session_123"
    
    enroll(session_id, feature_matrix)
    print(f"Successfully enrolled model at profiles/{session_id}.joblib")
    
    print("--- Scoring Normal Vectors ---")
    sum_normal = 0
    for i in range(10):
        vec = np.random.normal(loc=1.0, scale=0.1, size=12)
        res = score(session_id, vec)
        sum_normal += res["trust_score"]
        print(f"  Normal {i+1} -> Trust: {res['trust_score']}, Raw: {res['raw_score']:.3f}, Top Anomaly: {res['top_anomaly']}")
    
    print("--- Scoring Intruder Vectors ---")
    sum_intruder = 0
    for i in range(10):
        noise = 1.0 + np.random.choice([-0.4, 0.4], size=12)
        vec = np.random.normal(loc=1.0, scale=0.1, size=12) * noise
        res = score(session_id, vec)
        sum_intruder += res["trust_score"]
        print(f"  Intruder {i+1} -> Trust: {res['trust_score']}, Raw: {res['raw_score']:.3f}, Top Anomaly: {res['top_anomaly']}")

    avg_n = sum_normal / 10
    avg_i = sum_intruder / 10
    print(f"\nAverage Normal Score: {avg_n}")
    print(f"Average Intruder Score: {avg_i}")
