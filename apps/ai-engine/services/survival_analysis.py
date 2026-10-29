import numpy as np
from typing import Dict, Any, List

WEIBULL_PARAMETERS = {
    "BRAKE_PAD": {
        "lambda_scale": 65000.0,  # characteristic lifespan in km
        "k_shape": 3.2,           # wear-out failure stage (k > 1)
        "critical_threshold": 75.0,
        "action": "Immediate workshop replacement: risk of drum damage on ghat descents"
    },
    "CLUTCH_PLATE": {
        "lambda_scale": 110000.0,
        "k_shape": 3.5,
        "critical_threshold": 75.0,
        "action": "Schedule clutch pressure plate & lining inspection before next long haul"
    },
    "ENGINE_OIL": {
        "lambda_scale": 25000.0,
        "k_shape": 2.8,
        "critical_threshold": 70.0,
        "action": "Lube oil replacement & filter change due: viscosity breakdown"
    },
    "TYRE": {
        "lambda_scale": 85000.0,
        "k_shape": 3.0,
        "critical_threshold": 75.0,
        "action": "Measure tread depth: schedule retreading or scrap replacement"
    }
}

def weibull_cdf(t: float, lambda_scale: float, k_shape: float) -> float:
    """
    Cumulative failure probability F(t) = 1 - exp(-(t / lambda)^k)
    """
    if t <= 0:
        return 0.0
    val = 1.0 - np.exp(-((t / lambda_scale) ** k_shape))
    return float(np.clip(val, 0.0, 0.999))

def calculate_component_risk(component: str, km_since_service: float, avg_tonnage: float = 24.0, capacity_tons: float = 28.0) -> Dict[str, Any]:
    params = WEIBULL_PARAMETERS.get(component, {
        "lambda_scale": 60000.0,
        "k_shape": 2.5,
        "critical_threshold": 75.0,
        "action": "Scheduled preventive inspection"
    })
    
    # Stress factor based on weight ratio
    stress_multiplier = (avg_tonnage / max(capacity_tons, 1.0)) ** 1.25
    effective_km = km_since_service * max(0.8, stress_multiplier)
    
    failure_prob = weibull_cdf(effective_km, params["lambda_scale"], params["k_shape"]) * 100.0
    
    # Remaining useful life (approximate km until 85% failure probability)
    target_p = 0.85
    # t_target = lambda * (-ln(1 - p))^(1/k)
    t_target = params["lambda_scale"] * ((-np.log(1.0 - target_p)) ** (1.0 / params["k_shape"]))
    rul_km = max(0, int(t_target - effective_km))
    
    if failure_prob >= params["critical_threshold"]:
        priority = "CRITICAL"
    elif failure_prob >= 40.0:
        priority = "WATCH"
    else:
        priority = "NORMAL"

    return {
        "component": component,
        "km_since_service": int(km_since_service),
        "failure_probability": round(float(failure_prob), 1),
        "remaining_useful_life_km": rul_km,
        "priority": priority,
        "recommended_action": params["action"] if failure_prob >= 40.0 else "Component operating within normal wear envelope"
    }

def analyze_truck(truck: Dict[str, Any]) -> Dict[str, Any]:
    truck_id = str(truck.get("truck_id") or truck.get("_id"))
    reg_number = truck.get("regNumber", "UNKNOWN")
    capacity = truck.get("capacityTons", 28.0)
    current_odo = truck.get("currentOdometer", 100000)
    comp_service = truck.get("componentService", {})

    results = []
    for comp in ["BRAKE_PAD", "CLUTCH_PLATE", "ENGINE_OIL", "TYRE"]:
        last_odo = comp_service.get(comp, 0)
        km_run = max(0, current_odo - last_odo) if last_odo > 0 else (current_odo % 80000)
        risk = calculate_component_risk(comp, km_run, avg_tonnage=capacity * 0.85, capacity_tons=capacity)
        results.append(risk)

    max_prob = max(r["failure_probability"] for r in results)
    overall_health = round(100.0 - (max_prob * 0.7), 1)

    return {
        "truck_id": truck_id,
        "reg_number": reg_number,
        "current_odometer": current_odo,
        "overall_health_score": overall_health,
        "components": results
    }
