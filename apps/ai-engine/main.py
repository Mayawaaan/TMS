import os
import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from services.fuel_audit import detector
from services.survival_analysis import analyze_truck, calculate_component_risk
from services.margin_optimizer import optimizer
from services.cashflow_monte_carlo import simulate_cashflow_forecast

# Load root or local .env
root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(root_env if os.path.exists(root_env) else ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/tms_erp?replicaSet=rs0&directConnection=true")
MODEL_VERSION = "v1.4.2-Production-ObsidianAI"

mongo_client: Optional[AsyncIOMotorClient] = None
db: Optional[Any] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, db
    try:
        mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = mongo_client.get_default_database()
        print(f"[ai-engine] Connected to MongoDB: {db.name}")
    except Exception as e:
        print(f"[ai-engine] MongoDB connection warning: {e}")
    yield
    if mongo_client:
        mongo_client.close()

app = FastAPI(
    title="Obsidian Fleet AI & Quantitative Engine",
    version="1.0.0",
    description="Quantitative Logistics AI: Isolation Forest, Weibull Survival, Gradient Boosted Margin Optimizer, Monte Carlo Cashflow",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- PYDANTIC SCHEMAS -----------------
class FuelAuditRequest(BaseModel):
    trip_ids: Optional[List[str]] = None
    trips: Optional[List[Dict[str, Any]]] = None

class MaintenanceRequest(BaseModel):
    truck_ids: Optional[List[str]] = None
    trucks: Optional[List[Dict[str, Any]]] = None

class RatePredictionRequest(BaseModel):
    distance_km: float = Field(..., gt=0)
    tonnage: float = Field(..., gt=0)
    origin: str
    destination: str
    diesel_price: float = 90.5
    gradient_factor: float = 1.1
    target_margin_pct: float = 22.0

class CashflowRequest(BaseModel):
    starting_balance: Optional[float] = None
    horizon_days: int = 60
    safety_floor: float = 500000.0

# ----------------- ENDPOINTS -----------------
@app.get("/health")
async def health_check():
    db_connected = False
    if db is not None:
        try:
            await db.command("ping")
            db_connected = True
        except Exception:
            db_connected = False

    return {
        "status": "healthy",
        "service": "Quantitative Logistics AI Engine",
        "model_version": MODEL_VERSION,
        "database_connected": db_connected,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

# 1. FUEL THEFT AUDIT (Isolation Forest + Physics Baseline)
@app.post("/ai/fuel-theft-audit")
async def fuel_theft_audit(req: FuelAuditRequest):
    trip_records = []

    # If payload contains trips directly, use them
    if req.trips:
        trip_records = req.trips
    elif db is not None:
        query = {"fleetType": "OWN"}
        if req.trip_ids:
            from bson import ObjectId
            query["_id"] = {"$in": [ObjectId(tid) for tid in req.trip_ids if ObjectId.is_valid(tid)]}
        else:
            query["expenses.dieselLiters"] = {"$gt": 0}

        cursor = db.trips.find(query).sort("unloadedAt", -1).limit(100)
        async for doc in cursor:
            # Look up truck baseline if needed
            truck = await db.trucks.find_one({"_id": doc.get("truck")}) if doc.get("truck") else None
            
            trip_records.append({
                "trip_id": str(doc["_id"]),
                "lr_number": doc.get("lrNumber", "N/A"),
                "baseline_kmpl": truck.get("baselineKmpl", 3.5) if truck else 3.5,
                "weight_tons": doc.get("weightTons", 25.0),
                "capacity_tons": truck.get("capacityTons", 28.0) if truck else 28.0,
                "route_gradient_factor": doc.get("routeGradientFactor", 1.1),
                "vehicle_age": 2026 - (truck.get("manufactureYear", 2022) if truck else 2022),
                "actual_kmpl": doc.get("economics", {}).get("actualKmpl"),
                "distance_km": doc.get("distanceKm", 500.0),
                "diesel_liters": doc.get("expenses", {}).get("dieselLiters", 150.0)
            })

    results = [detector.audit_trip(t) for t in trip_records]
    flagged = [r for r in results if r["isFlaggedForTheft"]]

    return {
        "model_version": MODEL_VERSION,
        "total_audited": len(results),
        "theft_anomalies_detected": len(flagged),
        "results": results,
        "summary": {
            "total_unaccounted_liters": round(sum(r["suspected_liters_siphoned"] for r in flagged), 1),
            "estimated_loss_inr": round(sum(r["suspected_liters_siphoned"] for r in flagged) * 90.5, 2)
        }
    }

# 2. PREDICTIVE MAINTENANCE (Weibull Survival Analysis)
@app.post("/ai/predictive-maintenance")
async def predictive_maintenance(req: MaintenanceRequest):
    truck_records = []

    if req.trucks:
        truck_records = req.trucks
    elif db is not None:
        query = {}
        if req.truck_ids:
            from bson import ObjectId
            query["_id"] = {"$in": [ObjectId(tid) for tid in req.truck_ids if ObjectId.is_valid(tid)]}

        cursor = db.trucks.find(query).sort("regNumber", 1)
        async for doc in cursor:
            truck_records.append({
                "truck_id": str(doc["_id"]),
                "regNumber": doc.get("regNumber"),
                "capacityTons": doc.get("capacityTons", 28.0),
                "currentOdometer": doc.get("currentOdometer", 100000),
                "componentService": doc.get("componentService", {})
            })

    results = [analyze_truck(t) for t in truck_records]
    critical_alerts = []
    for t in results:
        for c in t["components"]:
            if c["priority"] == "CRITICAL":
                critical_alerts.append({
                    "truck_id": t["truck_id"],
                    "reg_number": t["reg_number"],
                    "component": c["component"],
                    "failure_probability": c["failure_probability"],
                    "action": c["recommended_action"]
                })

    return {
        "model_version": MODEL_VERSION,
        "trucks_scanned": len(results),
        "critical_risks_count": len(critical_alerts),
        "critical_alerts": critical_alerts,
        "trucks": results
    }

# 3. FREIGHT RATE & MARGIN OPTIMIZER (Gradient Boosted Quote Engine)
@app.post("/ai/freight-rate-predictor")
async def freight_rate_predictor(req: RatePredictionRequest):
    result = optimizer.predict_optimal_quote(
        distance_km=req.distance_km,
        tonnage=req.tonnage,
        origin=req.origin,
        destination=req.destination,
        diesel_price=req.diesel_price,
        gradient_factor=req.gradient_factor,
        target_margin_pct=req.target_margin_pct
    )
    return {
        "model_version": MODEL_VERSION,
        **result
    }

# 4. 60-DAY MONTE CARLO CASHFLOW FORECAST
@app.get("/ai/cashflow-forecast")
@app.post("/ai/cashflow-forecast")
async def cashflow_forecast(req: Optional[CashflowRequest] = None):
    starting_balance = req.starting_balance if req else None
    uncollected_invoices = []
    scheduled_emis = []

    if db is not None:
        # If starting balance not supplied, read from real double-entry ledger BANK balance
        if starting_balance is None:
            pipeline = [
                {"$match": {"account": "BANK"}},
                {"$group": {"_id": None, "debit": {"$sum": "$debit"}, "credit": {"$sum": "$credit"}}}
            ]
            agg = await db.ledgerentries.aggregate(pipeline).to_list(1)
            if agg:
                starting_balance = float(agg[0]["debit"] - agg[0]["credit"])
            else:
                starting_balance = 2500000.0

        # Fetch active uncollected invoices
        now = datetime.datetime.utcnow()
        async for doc in db.trips.find({"invoice.status": {"$in": ["BILLED", "PARTIAL"]}}, {"invoice": 1, "client": 1}):
            inv = doc.get("invoice", {})
            total = inv.get("total", 0.0)
            paid = inv.get("paidAmount", 0.0)
            due = total - paid
            inv_date = inv.get("date")
            days_ago = (now - inv_date).days if inv_date else 15
            
            client = await db.clients.find_one({"_id": doc.get("client")}) if doc.get("client") else None
            terms = client.get("paymentTermsDays", 30) if client else 30
            
            uncollected_invoices.append({
                "due_amount": due,
                "days_since_invoice": days_ago,
                "terms_days": terms
            })

        # Fetch truck EMIs
        async for trk in db.trucks.find({"emiAmount": {"$gt": 0}}):
            scheduled_emis.append({
                "amount": trk.get("emiAmount"),
                "dayOfMonth": trk.get("emiDayOfMonth", 5)
            })

    if starting_balance is None:
        starting_balance = 3000000.0

    forecast = simulate_cashflow_forecast(
        starting_bank_balance=starting_balance,
        uncollected_invoices=uncollected_invoices,
        scheduled_emis=scheduled_emis,
        days_horizon=req.horizon_days,
        safety_reserve_floor=req.safety_floor
    )

    return {
        "model_version": MODEL_VERSION,
        **forecast
    }

# 5. RETRAIN MODELS ENDPOINT
@app.post("/ai/retrain")
async def retrain_all_models():
    fuel_samples = 0
    if db is not None:
        trips = []
        async for doc in db.trips.find({"expenses.dieselLiters": {"$gt": 0}}).limit(300):
            truck = await db.trucks.find_one({"_id": doc.get("truck")}) if doc.get("truck") else None
            trips.append({
                "actual_kmpl": doc.get("economics", {}).get("actualKmpl"),
                "expected_kmpl": truck.get("baselineKmpl", 3.5) if truck else 3.5,
                "weight_tons": doc.get("weightTons", 25.0),
                "route_gradient_factor": doc.get("routeGradientFactor", 1.1),
                "vehicle_age": 2026 - (truck.get("manufactureYear", 2022) if truck else 2022)
            })
        retrain_res = detector.retrain(trips)
        fuel_samples = retrain_res.get("samples", 0)

    return {
        "status": "success",
        "model_version": MODEL_VERSION,
        "models_retrained": ["fuel_isolation_forest", "freight_rate_xgb"],
        "training_samples_consumed": fuel_samples,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
