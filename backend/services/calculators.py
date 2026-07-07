"""
Core cost + carbon math for EcoScale.

Cost model:   monthly_cost = hourly_usd * uptime_hrs_month  (+ storage @ $0.10/GB-month, EBS gp3-like)
Carbon model: kWh = (watts / 1000) * uptime_hrs_month
              kg_co2 = kWh * (gco2_per_kwh / 1000)
"""

STORAGE_USD_PER_GB_MONTH = 0.10


def enrich_resource(resource: dict, pricing: dict, carbon: dict) -> dict:
    itype = resource["instance_type"]
    region = resource["region"]

    spec = pricing.get(itype)
    grid = carbon.get(region)
    if spec is None or grid is None:
        # Defensive default so a bad row never crashes the API
        spec = spec or {"vcpu": 2, "ram_gb": 4, "hourly_usd": 0.05, "watts": 30}
        grid = grid or {"label": region, "gco2_per_kwh": 400, "renewable_pct": 30}

    uptime = resource["uptime_hrs_month"]

    compute_cost = spec["hourly_usd"] * uptime
    storage_cost = resource.get("storage_gb", 0) * STORAGE_USD_PER_GB_MONTH
    monthly_cost = round(compute_cost + storage_cost, 2)

    kwh = (spec["watts"] / 1000) * uptime
    kg_co2 = round(kwh * (grid["gco2_per_kwh"] / 1000), 3)

    enriched = dict(resource)
    enriched.update({
        "vcpu": spec["vcpu"],
        "ram_gb": spec["ram_gb"],
        "watts": spec["watts"],
        "region_label": grid["label"],
        "grid_gco2_per_kwh": grid["gco2_per_kwh"],
        "renewable_pct": grid["renewable_pct"],
        "monthly_cost_usd": monthly_cost,
        "monthly_kwh": round(kwh, 2),
        "monthly_kg_co2": kg_co2,
    })
    return enriched


def enrich_all(resources: list, pricing: dict, carbon: dict) -> list:
    return [enrich_resource(r, pricing, carbon) for r in resources]


def find_greenest_region(carbon: dict, exclude: str = None) -> tuple:
    candidates = [(r, v) for r, v in carbon.items() if r != exclude]
    best = min(candidates, key=lambda kv: kv[1]["gco2_per_kwh"])
    return best  # (region_code, region_dict)
