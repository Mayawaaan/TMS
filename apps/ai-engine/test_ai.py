import httpx
import pytest
import os
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_ai_health():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "model_version" in data

def test_fuel_theft_audit():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        res = client.post("/ai/fuel-theft-audit", json={})
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
        assert data["total_audited"] > 0
        
        # Verify that theft anomalies are detected
        flagged = [r for r in data["results"] if r["isFlaggedForTheft"]]
        assert len(flagged) >= 3, f"Expected at least 3 theft anomalies detected, got {len(flagged)}"
        
        # Verify siphoned liters calculated
        assert data["summary"]["total_unaccounted_liters"] > 100

def test_predictive_maintenance():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        res = client.post("/ai/predictive-maintenance", json={})
        assert res.status_code == 200
        data = res.json()
        assert "trucks" in data
        assert data["trucks_scanned"] == 15
        
        # Check that the critical brake pad risk on MP-09-GH-8823 was caught
        lemon_truck = next((t for t in data["trucks"] if t["reg_number"] == "MP-09-GH-8823"), None)
        assert lemon_truck is not None
        brake_risk = next((c for c in lemon_truck["components"] if c["component"] == "BRAKE_PAD"), None)
        assert brake_risk is not None
        assert brake_risk["failure_probability"] >= 80.0
        assert brake_risk["priority"] == "CRITICAL"

def test_freight_rate_predictor():
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        payload = {
            "origin": "Indore",
            "destination": "Mumbai",
            "distance_km": 585.0,
            "tonnage": 28.0,
            "diesel_price": 91.0,
            "gradient_factor": 1.25,
            "target_margin_pct": 22.0
        }
        res = client.post("/ai/freight-rate-predictor", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["break_even_floor_rate"] > 1000
        assert data["optimal_target_margin_rate"] > data["break_even_floor_rate"]
        assert data["backhaul_return_probability"] >= 80.0
        assert data["financial_breakdown"]["projected_margin_pct"] >= 20.0

def test_cashflow_monte_carlo():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        res = client.post("/ai/cashflow-forecast", json={"horizon_days": 60, "safety_floor": 500000.0})
        assert res.status_code == 200
        data = res.json()
        assert "daily_projection" in data
        assert len(data["daily_projection"]) == 60
        assert "min_p10_stress_balance" in data
        assert "min_p50_median_balance" in data
        # P90 >= P50 >= P10
        day_30 = data["daily_projection"][30]
        assert day_30["p90_optimistic"] >= day_30["p50_median"] >= day_30["p10_stress"]

def test_retrain_endpoint():
    with httpx.Client(base_url=BASE_URL, timeout=20.0) as client:
        res = client.post("/ai/retrain", json={})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"

if __name__ == "__main__":
    pytest.main(["-v", __file__])
