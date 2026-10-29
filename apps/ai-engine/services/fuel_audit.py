import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import os
from typing import List, Dict, Any, Optional

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_DIR, "fuel_isolation_forest.joblib")

def calculate_expected_kmpl(baseline_kmpl: float, tonnage: float, capacity: float, gradient: float, vehicle_age_years: float) -> float:
    """
    Physical fuel efficiency baseline model:
    - Baseline rated for loaded truck on nominal plains
    - Gradient section penalty: Kasara/Betul ghats add ~6-10% consumption
    - Load variation around 75% nominal capacity: ~0.4% per ton
    - Age degradation: ~0.5% per operational year
    """
    grad_adj = 1.0 + 0.35 * max(0.0, gradient - 1.0)
    load_adj = 1.0 + 0.004 * (tonnage - max(capacity, 1.0) * 0.75)
    age_adj = 1.0 + 0.005 * max(0.0, vehicle_age_years)
    expected = baseline_kmpl / (grad_adj * max(0.85, load_adj) * age_adj)
    return round(float(expected), 2)

class FuelAnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.08,
            random_state=42
        )
        self.is_fitted = False
        self._load_or_train()

    def _generate_synthetic_baseline(self) -> np.ndarray:
        """Baseline training set spanning Indian transport conditions."""
        np.random.seed(42)
        n = 600
        # Features: [delta_kmpl_ratio, tonnage, gradient, age]
        # Normal operations: delta_kmpl_ratio ~ N(1.0, 0.06)
        ratios = np.random.normal(1.0, 0.06, n)
        tonnages = np.random.uniform(5.0, 40.0, n)
        gradients = np.random.uniform(1.0, 1.35, n)
        ages = np.random.uniform(1.0, 7.0, n)
        
        # Injected anomalies (siphoning/slip inflation): delta_kmpl_ratio in 0.55 - 0.75
        n_anom = 45
        anom_ratios = np.random.uniform(0.55, 0.75, n_anom)
        anom_tonnages = np.random.uniform(15.0, 38.0, n_anom)
        anom_gradients = np.random.uniform(1.0, 1.30, n_anom)
        anom_ages = np.random.uniform(1.0, 6.0, n_anom)
        
        all_ratios = np.concatenate([ratios, anom_ratios])
        all_tonnages = np.concatenate([tonnages, anom_tonnages])
        all_gradients = np.concatenate([gradients, anom_gradients])
        all_ages = np.concatenate([ages, anom_ages])
        
        return np.column_stack([all_ratios, all_tonnages, all_gradients, all_ages])

    def _load_or_train(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                self.is_fitted = True
                return
            except Exception:
                pass
        
        X = self._generate_synthetic_baseline()
        self.model.fit(X)
        self.is_fitted = True
        try:
            joblib.dump(self.model, MODEL_PATH)
        except Exception:
            pass

    def retrain(self, trip_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        features = []
        for t in trip_records:
            if not t.get("actual_kmpl") or not t.get("expected_kmpl"):
                continue
            ratio = t["actual_kmpl"] / t["expected_kmpl"]
            features.append([
                ratio,
                t.get("weight_tons", 25.0),
                t.get("route_gradient_factor", 1.1),
                t.get("vehicle_age", 2.5)
            ])
        
        if len(features) < 30:
            X = self._generate_synthetic_baseline()
        else:
            X = np.array(features)
        
        self.model.fit(X)
        self.is_fitted = True
        joblib.dump(self.model, MODEL_PATH)
        return {"status": "retrained", "samples": len(X)}

    def audit_trip(self, trip: Dict[str, Any]) -> Dict[str, Any]:
        baseline_kmpl = trip.get("baseline_kmpl", 3.5)
        tonnage = trip.get("weight_tons", 25.0)
        capacity = trip.get("capacity_tons", 30.0)
        gradient = trip.get("route_gradient_factor", 1.1)
        age = trip.get("vehicle_age", 2.0)
        actual_kmpl = trip.get("actual_kmpl")
        distance_km = trip.get("distance_km", 500.0)
        diesel_liters = trip.get("diesel_liters", 150.0)

        expected_kmpl = calculate_expected_kmpl(baseline_kmpl, tonnage, capacity, gradient, age)
        
        if not actual_kmpl and diesel_liters > 0:
            actual_kmpl = round(distance_km / diesel_liters, 2)
        elif not actual_kmpl:
            actual_kmpl = expected_kmpl

        ratio = actual_kmpl / max(expected_kmpl, 0.5)
        
        # Feature vector for Isolation Forest
        X_test = np.array([[ratio, tonnage, gradient, age]])
        anomaly_score = float(self.model.decision_function(X_test)[0])
        # Business logic rules for theft:
        # 1. Isolation Forest identifies statistical outlier (decision_function < 0.05 or predict == -1)
        # 2. Actual KMPL is at least 18% lower than physical corridor expectation
        is_theft = bool(ratio < 0.82 and (anomaly_score < 0.05 or self.model.predict(X_test)[0] == -1))
        
        # Calculate siphoned liters
        allowed_liters = distance_km / expected_kmpl
        suspected_liters = round(max(0.0, diesel_liters - (allowed_liters * 1.04)), 1) if is_theft else 0.0

        reasons = []
        if is_theft:
            reasons.append(f"Fuel consumption {round((1.0 - ratio)*100, 1)}% higher than physical corridor expectations")
            if ratio < 0.72:
                reasons.append("Severe negative mileage spike indicative of diesel tank siphoning")
            if suspected_liters > 60:
                reasons.append(f"Unaccounted fuel slip discrepancy (~{int(suspected_liters)} L)")

        return {
            "trip_id": str(trip.get("trip_id") or trip.get("_id")),
            "lr_number": trip.get("lr_number", "UNKNOWN"),
            "anomaly_score": round(anomaly_score, 3),
            "expected_kmpl": expected_kmpl,
            "actual_kmpl": round(float(actual_kmpl), 2),
            "isFlaggedForTheft": is_theft,
            "suspected_liters_siphoned": suspected_liters,
            "reasons": reasons
        }

detector = FuelAnomalyDetector()
