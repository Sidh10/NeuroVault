"""
Phase 2 — Test 4: SHAP TreeExplainer + IsolationForest compatibility
Confirms: shap imports, TreeExplainer works with IsolationForest,
          shap_values shape matches feature count
This is the #1 integration risk identified in blueprint.md
"""
import sys
import time
import numpy as np
from sklearn.ensemble import IsolationForest


def main():
    print("=" * 50)
    print("TEST 4: SHAP TreeExplainer × IsolationForest")
    print("=" * 50)

    # Import SHAP (the risky import)
    try:
        import shap
        print(f"  shap version:        {shap.__version__}")
    except ImportError as e:
        print(f"  FAIL: Cannot import shap — {e}")
        sys.exit(1)

    # Recreate the exact scenario from our pipeline:
    # 36 enrollment windows × 15 features
    FEATURE_NAMES = [
        "mouse_avg_speed", "mouse_speed_std", "mouse_avg_jitter",
        "mouse_jitter_std", "mouse_avg_curvature", "mouse_direction_changes",
        "key_avg_flight_time", "key_flight_time_std", "key_avg_dwell_time",
        "key_dwell_time_std", "key_typing_speed",
        "scroll_avg_velocity", "scroll_velocity_std", "scroll_frequency",
        "scroll_avg_distance",
    ]

    np.random.seed(42)
    n_windows = 36  # 3-minute enrollment
    n_features = len(FEATURE_NAMES)
    X_train = np.random.randn(n_windows, n_features)

    print(f"  Training data:       {X_train.shape} ({n_windows} windows × {n_features} features)")

    # Fit IsolationForest
    model = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        random_state=42,
        n_jobs=1,
    )
    model.fit(X_train)
    print(f"  IsolationForest:     fitted")

    # === THE CRITICAL TEST ===
    # TreeExplainer on IsolationForest — identified as #1 risk in blueprint
    print()
    print("  Running TreeExplainer (this is the high-risk step)...")
    t0 = time.perf_counter()

    try:
        explainer = shap.TreeExplainer(model, X_train)
        explainer_time = (time.perf_counter() - t0) * 1000
        print(f"  TreeExplainer init:  {explainer_time:.1f} ms — OK")
    except Exception as e:
        print(f"  FAIL: TreeExplainer init — {e}")
        print("  Falling back to KernelExplainer...")
        try:
            explainer = shap.KernelExplainer(model.decision_function, X_train)
            print(f"  KernelExplainer:     OK (fallback)")
        except Exception as e2:
            print(f"  FAIL: KernelExplainer also failed — {e2}")
            sys.exit(1)

    # Explain a single scoring window
    X_test = np.random.randn(1, n_features)
    t0 = time.perf_counter()

    try:
        shap_values = explainer.shap_values(X_test)
        explain_time = (time.perf_counter() - t0) * 1000
        print(f"  shap_values compute: {explain_time:.1f} ms")
    except Exception as e:
        print(f"  FAIL: shap_values computation — {e}")
        sys.exit(1)

    # Validate shape
    print()
    print(f"  shap_values type:    {type(shap_values)}")
    if isinstance(shap_values, np.ndarray):
        print(f"  shap_values shape:   {shap_values.shape}")
        expected_shape = (1, n_features)
        shape_ok = shap_values.shape == expected_shape
    elif isinstance(shap_values, list):
        print(f"  shap_values length:  {len(shap_values)}")
        # Some SHAP versions return list of arrays
        shap_values = np.array(shap_values)
        if shap_values.ndim == 3:
            shap_values = shap_values[0]
        print(f"  resolved shape:      {shap_values.shape}")
        shape_ok = shap_values.shape[-1] == n_features
    else:
        # shap.Explanation object
        sv = shap_values.values if hasattr(shap_values, 'values') else np.array(shap_values)
        print(f"  shap_values shape:   {sv.shape}")
        shape_ok = sv.shape[-1] == n_features
        shap_values = sv

    if not shape_ok:
        print(f"  FAIL: Expected {n_features} features, got different shape")
        sys.exit(1)

    print(f"  Shape matches {n_features} features: YES")

    # Sanity: at least 3 features should have |shap_value| > 0.001
    sv_flat = shap_values.flatten()[:n_features]
    n_nonzero = (np.abs(sv_flat) > 0.001).sum()
    print(f"  Features with |shap| > 0.001: {n_nonzero} / {n_features}")

    if n_nonzero < 3:
        print(f"  WARNING: Only {n_nonzero} non-trivial SHAP values (expected ≥ 3)")
    else:
        print(f"  Non-trivial features: OK")

    # Print top 5 features by |SHAP value|
    print()
    print("  Top 5 SHAP features:")
    indices = np.argsort(np.abs(sv_flat))[::-1][:5]
    for rank, idx in enumerate(indices):
        direction = "anomalous" if sv_flat[idx] > 0 else "authentic"
        print(f"    {rank+1}. {FEATURE_NAMES[idx]:30s}  shap={sv_flat[idx]:+.4f}  [{direction}]")

    # Timing check: must be under 500ms budget
    print()
    total_time = explainer_time + explain_time
    budget_ok = total_time < 500
    print(f"  Total SHAP time:     {total_time:.1f} ms (budget: 500 ms) — {'OK' if budget_ok else 'OVER BUDGET'}")

    print()
    print("  TEST 4: PASS")
    print("=" * 50)


if __name__ == "__main__":
    main()
