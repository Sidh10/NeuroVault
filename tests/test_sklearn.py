"""
Phase 2 — Test 3: scikit-learn IsolationForest smoke test
Confirms: sklearn imports, IsolationForest fits and scores, CPU-only
"""
import sys
import time
import numpy as np
from sklearn.ensemble import IsolationForest


def main():
    print("=" * 50)
    print("TEST 3: scikit-learn IsolationForest")
    print("=" * 50)

    # Check versions
    import sklearn
    print(f"  scikit-learn version: {sklearn.__version__}")
    print(f"  numpy version:       {np.__version__}")
    print(f"  Python version:      {sys.version.split()[0]}")
    print()

    # Generate synthetic training data (100 rows × 15 features)
    # Mimics 100 enrollment windows of our 15-feature vector
    np.random.seed(42)
    n_train = 100
    n_features = 15
    X_train = np.random.randn(n_train, n_features)
    print(f"  Training data shape: {X_train.shape}")

    # Fit IsolationForest (same params as blueprint)
    t0 = time.perf_counter()
    model = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
        n_jobs=1,
    )
    model.fit(X_train)
    fit_time = (time.perf_counter() - t0) * 1000
    print(f"  Fit time:            {fit_time:.1f} ms")

    # Score 10 new rows (simulating 10 scoring windows)
    X_test = np.random.randn(10, n_features)
    t0 = time.perf_counter()
    raw_scores = model.decision_function(X_test)
    score_time = (time.perf_counter() - t0) * 1000
    print(f"  Score time (10 rows): {score_time:.1f} ms")
    print()

    # Normalize to 0–100 trust score
    # decision_function: higher = more normal, lower = more anomalous
    # We map to 0–100 where 100 = fully authentic
    baseline_mean = model.decision_function(X_train).mean()
    baseline_std = model.decision_function(X_train).std()

    trust_scores = []
    for raw in raw_scores:
        # Z-score normalization, then sigmoid-like mapping to 0–100
        z = (raw - baseline_mean) / (baseline_std + 1e-8)
        trust = max(0.0, min(100.0, 50.0 + z * 25.0))
        trust_scores.append(trust)

    print("  Anomaly scores (10 test windows):")
    for i, (raw, trust) in enumerate(zip(raw_scores, trust_scores)):
        status = "ANOMALY" if trust < 50 else "OK"
        print(f"    Window {i}: raw={raw:+.4f}  trust={trust:.1f}  [{status}]")

    print()

    # Verify predictions array
    predictions = model.predict(X_test)
    n_inliers = (predictions == 1).sum()
    n_outliers = (predictions == -1).sum()
    print(f"  Predictions: {n_inliers} inliers, {n_outliers} outliers")

    # Confirm no GPU
    print()
    print("  GPU required: NO (scikit-learn is CPU-only)")
    print()
    print("  TEST 3: PASS")
    print("=" * 50)


if __name__ == "__main__":
    main()
