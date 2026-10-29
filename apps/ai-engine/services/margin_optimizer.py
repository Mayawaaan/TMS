import numpy as np
import xgboost as xgb
import os
import joblib
from typing import Dict, Any, List

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)
RATE_MODEL_PATH = os.path.join(MODEL_DIR, "freight_rate_xgb.joblib")

# Empirical corridor backhaul return load probabilities
CORRIDOR_BACKHAUL_STATS = {
    "Mumbai": 0.88,      # Nhava Sheva port has continuous inbound chemical/import demand
    "Pune": 0.82,        # Chakan auto cluster ships engineering goods
    "Ahmedabad": 0.76,   # Sanand & chemical belts
    "Delhi": 0.70,       # Northern distribution hub
    "Nagpur": 0.65,      # Central logistics junction
    "Hyderabad": 0.62,   # Steel & pharma
    "Chennai": 0.58,     # Longer transit, lower return density
    "Kolkata": 0.50,     # Low direct return corridor
    "Bengaluru": 0.60,   # Auto and electronics
    "Raipur": 0.54,      # Mining / steel outbound
}

class FreightRateOptimizer:
    def __init__(self):
        self.model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.08,
            random_state=42
        )
        self.is_fitted = False
        self._load_or_train()

    def _generate_synthetic_data(self):
        np.random.seed(42)
        n = 800
        # Features: [distance_km, tonnage, diesel_price, gradient, toll_per_km]
        dist = np.random.uniform(200, 1600, n)
        tons = np.random.uniform(10, 38, n)
        fuel = np.random.uniform(88, 96, n)
        grad = np.random.uniform(1.0, 1.3, n)
        toll = np.random.uniform(2.5, 4.0, n)
        
        # Target: Market rate per ton
        # Base direct operating cost:
        # kmpl approx 3.4 / grad
        kmpl = 3.4 / grad
        fuel_cost = (dist / kmpl) * fuel
        toll_cost = dist * toll
        bhatta = (dist / 400.0) * 450.0
        maint_reserve = dist * 2.8
        total_trip_cost = fuel_cost + toll_cost + bhatta + maint_reserve + 2500.0
        
        cost_per_ton = total_trip_cost / tons
        # Market margin 18 - 25%
        margin = np.random.uniform(0.18, 0.25, n)
        market_rate = cost_per_ton / (1.0 - margin)
        
        X = np.column_stack([dist, tons, fuel, grad, toll])
        y = market_rate
        return X, y

    def _load_or_train(self):
        if os.path.exists(RATE_MODEL_PATH):
            try:
                self.model = joblib.load(RATE_MODEL_PATH)
                self.is_fitted = True
                return
            except Exception:
                pass
        
        X, y = self._generate_synthetic_data()
        self.model.fit(X, y)
        self.is_fitted = True
        try:
            joblib.dump(self.model, RATE_MODEL_PATH)
        except Exception:
            pass

    def retrain(self, historical_trips: List[Dict[str, Any]]) -> Dict[str, Any]:
        features = []
        targets = []
        for t in historical_trips:
            dist = t.get("distance_km")
            tons = t.get("weight_tons")
            rate = t.get("rate_per_ton")
            if dist and tons and rate:
                features.append([
                    dist,
                    tons,
                    t.get("diesel_price", 90.5),
                    t.get("route_gradient_factor", 1.1),
                    t.get("toll_per_km", 3.2)
                ])
                targets.append(rate)
        
        if len(features) < 40:
            X, y = self._generate_synthetic_data()
        else:
            X, y = np.array(features), np.array(targets)

        self.model.fit(X, y)
        self.is_fitted = True
        joblib.dump(self.model, RATE_MODEL_PATH)
        return {"status": "retrained", "samples": len(X)}

    def predict_optimal_quote(
        self,
        distance_km: float,
        tonnage: float,
        origin: str,
        destination: str,
        diesel_price: float = 90.5,
        gradient_factor: float = 1.1,
        target_margin_pct: float = 22.0
    ) -> Dict[str, Any]:
        # 1. Physics-based direct trip cost calculation
        # Effective KMPL on this corridor:
        effective_kmpl = max(2.0, 3.6 / (gradient_factor * (1.0 + 0.007 * tonnage)))
        diesel_liters = distance_km / effective_kmpl
        fuel_cost = diesel_liters * diesel_price
        
        # FASTag toll estimate (~₹3.2/km)
        toll_cost = distance_km * 3.2
        
        # Bhatta & highway enroute expenses
        trip_days = max(1.0, distance_km / 420.0)
        bhatta_cost = trip_days * 400.0
        rto_loading = 1500.0
        
        # Vehicle fixed allocation (EMI + Maintenance reserve: ~₹5.5/km)
        fixed_fleet_allocation = distance_km * 5.5
        
        total_trip_cost = fuel_cost + toll_cost + bhatta_cost + rto_loading + fixed_fleet_allocation
        
        # Break-Even Floor Rate per ton
        floor_rate_per_ton = round(total_trip_cost / max(tonnage, 1.0), 2)
        
        # Optimal Target Margin Quote (default 22%)
        margin_decimal = min(0.40, max(0.10, target_margin_pct / 100.0))
        optimal_rate_per_ton = round(floor_rate_per_ton / (1.0 - margin_decimal), 2)
        
        # Machine Learning Predicted Market Clearing Rate
        X_eval = np.array([[distance_km, tonnage, diesel_price, gradient_factor, 3.2]])
        ml_predicted_rate = float(self.model.predict(X_eval)[0])
        
        # Backhaul probability lookup
        backhaul_prob = CORRIDOR_BACKHAUL_STATS.get(destination, 0.65)
        # If destination backhaul probability is low (<60%), add a return empty compensation buffer
        empty_risk_buffer = 0.0
        if backhaul_prob < 0.60:
            empty_risk_buffer = round(floor_rate_per_ton * (0.60 - backhaul_prob) * 0.5, 2)

        recommended_quote = round(optimal_rate_per_ton + empty_risk_buffer, 2)
        gross_projected_revenue = round(recommended_quote * tonnage, 2)
        net_projected_profit = round(gross_projected_revenue - total_trip_cost, 2)
        effective_margin = round((net_projected_profit / gross_projected_revenue) * 100.0, 2)

        return {
            "corridor": f"{origin} → {destination}",
            "distance_km": distance_km,
            "tonnage": tonnage,
            "break_even_floor_rate": floor_rate_per_ton,
            "optimal_target_margin_rate": optimal_rate_per_ton,
            "recommended_quote_rate": recommended_quote,
            "ml_benchmark_market_rate": round(ml_predicted_rate, 2),
            "backhaul_return_probability": round(backhaul_prob * 100.0, 1),
            "empty_haul_risk_surcharge": empty_risk_buffer,
            "financial_breakdown": {
                "projected_revenue": gross_projected_revenue,
                "projected_cost": round(total_trip_cost, 2),
                "projected_net_profit": net_projected_profit,
                "projected_margin_pct": effective_margin,
                "cost_components": {
                    "fuel_cost": round(fuel_cost, 2),
                    "toll_cost": round(toll_cost, 2),
                    "driver_bhatta": round(bhatta_cost, 2),
                    "fixed_fleet_allocation": round(fixed_fleet_allocation, 2)
                }
            }
        }

optimizer = FreightRateOptimizer()
