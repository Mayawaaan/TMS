import numpy as np
import datetime
from typing import Dict, Any, List

def simulate_cashflow_forecast(
    starting_bank_balance: float,
    uncollected_invoices: List[Dict[str, Any]],
    scheduled_emis: List[Dict[str, Any]],
    upcoming_payroll_monthly: float = 380000.0,
    daily_operational_expense: float = 45000.0,
    days_horizon: int = 60,
    num_simulations: int = 1000,
    safety_reserve_floor: float = 500000.0
) -> Dict[str, Any]:
    """
    Monte Carlo Liquidity Simulator:
    - Inflows: Each uncollected invoice has an expected payment date sampled from
      Actual Delay = Terms + N(mu=8.5 days, sigma=6.0 days)
    - Outflows:
      * Fixed EMIs on deterministic days (5th, 10th, 15th)
      * Monthly Driver & Staff Payroll on 7th
      * Variable Fuel & Toll operational burns
    """
    np.random.seed(42)
    today = datetime.date.today()
    
    # Pre-parse deterministic outflows for days 0..days_horizon-1
    daily_fixed_outflows = np.zeros(days_horizon)
    
    for day_idx in range(days_horizon):
        current_date = today + datetime.timedelta(days=day_idx)
        dom = current_date.day
        
        # Payroll on 7th of each month
        if dom == 7:
            daily_fixed_outflows[day_idx] += upcoming_payroll_monthly
            
        # Daily fuel, fastag, and petty operational burns
        daily_fixed_outflows[day_idx] += daily_operational_expense

    # Scheduled Truck EMIs
    for emi in scheduled_emis:
        emi_day = emi.get("dayOfMonth", 5)
        amount = emi.get("amount", 60000.0)
        for day_idx in range(days_horizon):
            current_date = today + datetime.timedelta(days=day_idx)
            if current_date.day == emi_day:
                daily_fixed_outflows[day_idx] += amount

    # Matrix of simulations: shape (num_simulations, days_horizon)
    daily_balances = np.zeros((num_simulations, days_horizon))

    # Pre-extract invoice data
    inv_data = []
    for inv in uncollected_invoices:
        due_amount = float(inv.get("due_amount", 0.0))
        if due_amount <= 0:
            continue
        days_since_invoice = float(inv.get("days_since_invoice", 10.0))
        terms = float(inv.get("terms_days", 30.0))
        inv_data.append((due_amount, days_since_invoice, terms))

    for sim_idx in range(num_simulations):
        # Accumulate simulated daily cash inflows for this path
        daily_inflows = np.zeros(days_horizon)
        
        for due_amount, days_since_invoice, terms in inv_data:
            # Payment delay distribution: Normal(terms + 8.5, sigma=6.0)
            total_delay = np.random.normal(terms + 8.5, 6.0)
            days_from_today = int(np.round(total_delay - days_since_invoice))
            
            # 3% probability of severe default/dispute delay (+35 days)
            if np.random.rand() < 0.03:
                days_from_today += np.random.randint(25, 45)
                
            if 0 <= days_from_today < days_horizon:
                daily_inflows[days_from_today] += due_amount
            elif days_from_today < 0:
                # Overdue payment landing in immediate 1-3 days
                landing = np.random.randint(0, min(4, days_horizon))
                daily_inflows[landing] += due_amount

        # Stochastic variation on daily operational burn (+-15%)
        stochastic_outflows = daily_fixed_outflows * np.random.uniform(0.85, 1.15, days_horizon)
        
        # Roll forward balance
        balance = starting_bank_balance
        for d in range(days_horizon):
            balance += daily_inflows[d] - stochastic_outflows[d]
            daily_balances[sim_idx, d] = balance

    # Compute percentiles across all simulations: P10 (Stress), P50 (Median), P90 (Optimistic)
    p10 = np.percentile(daily_balances, 10, axis=0)
    p50 = np.percentile(daily_balances, 50, axis=0)
    p90 = np.percentile(daily_balances, 90, axis=0)

    # Find minimum balance and risk dates
    min_p10 = float(np.min(p10))
    min_p50 = float(np.min(p50))
    
    liquidity_deficit_risk = min_p10 < safety_reserve_floor
    deficit_days = int(np.sum(p10 < safety_reserve_floor))

    # Format daily series
    daily_projection = []
    for d in range(days_horizon):
        date_str = (today + datetime.timedelta(days=d)).strftime("%Y-%m-%d")
        daily_projection.append({
            "date": date_str,
            "day_index": d,
            "p10_stress": int(p10[d]),
            "p50_median": int(p50[d]),
            "p90_optimistic": int(p90[d]),
            "safety_floor": int(safety_reserve_floor)
        })

    recommendations = []
    if liquidity_deficit_risk:
        lowest_day_idx = int(np.argmin(p10))
        lowest_date = (today + datetime.timedelta(days=lowest_day_idx)).strftime("%d %b %Y")
        deficit_amount = int(safety_reserve_floor - min_p10)
        recommendations.append(
            f"Liquidity stress warning: P10 balance drops to ₹{int(min_p10):,} around {lowest_date}. "
            f"Arrange temporary OD facility or accelerate party collections for ₹{deficit_amount:,}."
        )
    else:
        recommendations.append("Healthy working capital liquidity runway across next 60 days under all P10 scenarios.")

    return {
        "starting_balance": starting_bank_balance,
        "horizon_days": days_horizon,
        "simulations_count": num_simulations,
        "min_p10_stress_balance": int(min_p10),
        "min_p50_median_balance": int(min_p50),
        "liquidity_deficit_flag": liquidity_deficit_risk,
        "stress_days_below_safety_floor": deficit_days,
        "recommendations": recommendations,
        "daily_projection": daily_projection
    }
