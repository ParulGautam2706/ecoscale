import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from services.calculators import enrich_all
from services.optimizer import tier_resources, generate_recommendations, simulate_action

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

app = Flask(__name__)
CORS(app)


def load_json(name):
    with open(os.path.join(DATA_DIR, name)) as f:
        return json.load(f)


def get_dataset():
    """Load + enrich + tier the full resource set. Recomputed per-request
    since the dataset is small; swap for a cache/db in a real deployment."""
    resources = load_json("resources.json")
    pricing = load_json("instance_pricing.json")
    carbon = load_json("carbon_intensity.json")

    enriched = enrich_all(resources, pricing, carbon)
    tiered = tier_resources(enriched)
    return tiered, pricing, carbon


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "ecoscale-backend"})


@app.route("/api/resources")
def get_resources():
    resources, _, _ = get_dataset()

    region_filter = request.args.get("region")
    tier_filter = request.args.get("tier")
    if region_filter:
        resources = [r for r in resources if r["region"] == region_filter]
    if tier_filter:
        resources = [r for r in resources if r["utilization_tier"] == tier_filter]

    return jsonify(resources)


@app.route("/api/regions")
def get_regions():
    carbon = load_json("carbon_intensity.json")
    return jsonify(carbon)


@app.route("/api/dashboard")
def get_dashboard():
    resources, _, _ = get_dataset()

    total_cost = round(sum(r["monthly_cost_usd"] for r in resources), 2)
    total_co2 = round(sum(r["monthly_kg_co2"] for r in resources), 2)
    total_kwh = round(sum(r["monthly_kwh"] for r in resources), 2)

    by_region = {}
    for r in resources:
        b = by_region.setdefault(r["region"], {"region_label": r["region_label"], "cost": 0.0, "co2": 0.0, "count": 0})
        b["cost"] = round(b["cost"] + r["monthly_cost_usd"], 2)
        b["co2"] = round(b["co2"] + r["monthly_kg_co2"], 3)
        b["count"] += 1

    by_tier = {}
    for r in resources:
        t = by_tier.setdefault(r["utilization_tier"], {"cost": 0.0, "co2": 0.0, "count": 0})
        t["cost"] = round(t["cost"] + r["monthly_cost_usd"], 2)
        t["co2"] = round(t["co2"] + r["monthly_kg_co2"], 3)
        t["count"] += 1

    recs = generate_recommendations(resources, load_json("carbon_intensity.json"))
    potential_savings_usd = round(sum(rc["est_monthly_savings_usd"] for rc in recs), 2)
    potential_savings_co2 = round(sum(rc["est_monthly_co2_savings_kg"] for rc in recs), 3)

    return jsonify({
        "total_monthly_cost_usd": total_cost,
        "total_monthly_kg_co2": total_co2,
        "total_monthly_kwh": total_kwh,
        "resource_count": len(resources),
        "potential_monthly_savings_usd": potential_savings_usd,
        "potential_monthly_co2_savings_kg": potential_savings_co2,
        "by_region": by_region,
        "by_tier": by_tier,
    })


@app.route("/api/recommendations")
def get_recommendations():
    resources, _, carbon = get_dataset()
    recs = generate_recommendations(resources, carbon)

    severity_filter = request.args.get("severity")
    if severity_filter:
        recs = [r for r in recs if r["severity"] == severity_filter]

    return jsonify(recs)


@app.route("/api/simulate", methods=["POST"])
def post_simulate():
    body = request.get_json(force=True) or {}
    resource_id = body.get("resource_id")
    action = body.get("action")

    if not resource_id or not action:
        return jsonify({"error": "resource_id and action are required"}), 400

    raw_resources = load_json("resources.json")
    pricing = load_json("instance_pricing.json")
    carbon = load_json("carbon_intensity.json")

    target = next((r for r in raw_resources if r["id"] == resource_id), None)
    if target is None:
        return jsonify({"error": f"resource {resource_id} not found"}), 404

    try:
        result = simulate_action(target, action, pricing, carbon)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
