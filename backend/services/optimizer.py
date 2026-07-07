"""
EcoScale optimization engine.

1. Clusters resources by (cpu_util_pct, mem_util_pct) using KMeans into
   utilization tiers (idle / underused / optimal / overused). This is the
   "AI" layer -- an unsupervised model that groups resources by behavior
   instead of hard-coded thresholds, so tiers are learned from the actual
   fleet's distribution rather than fixed cutoffs.
2. Runs rule-based checks on top of the tiers to generate concrete,
   actionable recommendations with estimated monthly $ and kg CO2 savings.
"""

import numpy as np
from sklearn.cluster import KMeans

from services.calculators import find_greenest_region

DOWNSIZE_MAP = {
    "m5.2xlarge": "m5.xlarge", "m5.xlarge": "m5.large", "m5.large": "t3.medium",
    "c5.4xlarge": "c5.xlarge", "c5.xlarge": "c5.large", "c5.large": "t3.medium",
    "r5.2xlarge": "r5.xlarge", "r5.xlarge": "r5.large", "r5.large": "m5.large",
    "t3.medium": "t3.small", "t3.small": "t3.micro",
}


def tier_resources(enriched_resources: list) -> list:
    """Attach a `utilization_tier` label to each resource via KMeans clustering."""
    if len(enriched_resources) < 4:
        for r in enriched_resources:
            r["utilization_tier"] = "optimal"
        return enriched_resources

    X = np.array([[r["cpu_util_pct"], r["mem_util_pct"]] for r in enriched_resources])
    k = 4
    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X)

    # Rank clusters by mean utilization (cpu+mem) ascending, then label them
    centers = km.cluster_centers_
    order = np.argsort(centers.sum(axis=1))
    labels_by_rank = ["idle", "underused", "optimal", "overused"]
    cluster_to_label = {cluster_id: labels_by_rank[rank] for rank, cluster_id in enumerate(order)}

    for r, cluster_id in zip(enriched_resources, km.labels_):
        r["utilization_tier"] = cluster_to_label[int(cluster_id)]
    return enriched_resources


def generate_recommendations(enriched_resources: list, carbon: dict) -> list:
    recs = []

    for r in enriched_resources:
        tier = r.get("utilization_tier")

        # 1. Idle resource -> recommend termination / stopping
        if tier == "idle" and r["uptime_hrs_month"] >= 480:
            recs.append({
                "resource_id": r["id"],
                "resource_name": r["name"],
                "type": "decommission",
                "severity": "high",
                "title": f"Stop or terminate idle resource \"{r['name']}\"",
                "detail": (f"CPU util {r['cpu_util_pct']}% and memory util {r['mem_util_pct']}% "
                           f"for {r['uptime_hrs_month']} hrs/month. This resource is effectively idle."),
                "est_monthly_savings_usd": round(r["monthly_cost_usd"] * 0.95, 2),
                "est_monthly_co2_savings_kg": round(r["monthly_kg_co2"] * 0.95, 3),
            })
            continue

        # 2. Underused -> recommend downsizing
        if tier == "underused" and r["instance_type"] in DOWNSIZE_MAP:
            smaller = DOWNSIZE_MAP[r["instance_type"]]
            # crude estimate: downsizing one tier saves ~45% of compute cost/power
            recs.append({
                "resource_id": r["id"],
                "resource_name": r["name"],
                "type": "rightsize",
                "severity": "medium",
                "title": f"Downsize \"{r['name']}\" from {r['instance_type']} to {smaller}",
                "detail": (f"CPU util {r['cpu_util_pct']}%, memory util {r['mem_util_pct']}% — "
                           f"well below the {r['instance_type']} allocation. A smaller instance "
                           f"comfortably covers this load."),
                "est_monthly_savings_usd": round(r["monthly_cost_usd"] * 0.45, 2),
                "est_monthly_co2_savings_kg": round(r["monthly_kg_co2"] * 0.40, 3),
            })

        # 3. Overused -> flag for upsizing (cost goes up, but prevents outages;
        #    still worth surfacing as an action item)
        if tier == "overused":
            recs.append({
                "resource_id": r["id"],
                "resource_name": r["name"],
                "type": "upsize_risk",
                "severity": "medium",
                "title": f"\"{r['name']}\" is running hot — risk of throttling",
                "detail": (f"CPU util {r['cpu_util_pct']}%, memory util {r['mem_util_pct']}%. "
                           f"Consider upsizing or horizontal scaling to avoid performance issues."),
                "est_monthly_savings_usd": 0.0,
                "est_monthly_co2_savings_kg": 0.0,
            })

        # 4. Dirty-grid region shift -> recommend moving to a cleaner region
        #    (only for non-idle, non-overused, since those get handled above)
        if r["grid_gco2_per_kwh"] > 350 and tier in ("optimal", "underused"):
            greenest_code, greenest = find_greenest_region(carbon, exclude=r["region"])
            co2_savings = round(r["monthly_kg_co2"] * (1 - greenest["gco2_per_kwh"] / r["grid_gco2_per_kwh"]), 3)
            if co2_savings > 0.05:
                recs.append({
                    "resource_id": r["id"],
                    "resource_name": r["name"],
                    "type": "region_shift",
                    "severity": "low",
                    "title": f"Migrate \"{r['name']}\" to {greenest['label']} ({greenest_code})",
                    "detail": (f"Current region ({r['region_label']}) grid intensity is "
                               f"{r['grid_gco2_per_kwh']} gCO2/kWh vs {greenest['gco2_per_kwh']} "
                               f"gCO2/kWh in {greenest['label']}. Same compute, lower emissions."),
                    "est_monthly_savings_usd": 0.0,
                    "est_monthly_co2_savings_kg": co2_savings,
                })

        # 5. Reserved-instance style suggestion for steady, always-on, well-fitted workloads
        if tier == "optimal" and r["uptime_hrs_month"] >= 720:
            recs.append({
                "resource_id": r["id"],
                "resource_name": r["name"],
                "type": "commitment_discount",
                "severity": "low",
                "title": f"Commit \"{r['name']}\" to a 1-yr reserved/savings plan",
                "detail": ("Steady 24/7 utilization at a well-matched size — a strong candidate "
                           "for a reserved instance or savings plan (typically ~30-40% off on-demand)."),
                "est_monthly_savings_usd": round(r["monthly_cost_usd"] * 0.35, 2),
                "est_monthly_co2_savings_kg": 0.0,
            })

    recs.sort(key=lambda x: (x["est_monthly_savings_usd"] + x["est_monthly_co2_savings_kg"] * 5), reverse=True)
    return recs


def simulate_action(resource: dict, action: str, pricing: dict, carbon: dict) -> dict:
    """Return a projected before/after impact for a single what-if action."""
    from services.calculators import enrich_resource

    before = enrich_resource(resource, pricing, carbon)
    after_res = dict(resource)

    if action == "stop":
        after_res["uptime_hrs_month"] = 0
    elif action == "downsize":
        smaller = DOWNSIZE_MAP.get(resource["instance_type"])
        if smaller:
            after_res["instance_type"] = smaller
    elif action == "move_to_greenest":
        greenest_code, _ = find_greenest_region(carbon, exclude=resource["region"])
        after_res["region"] = greenest_code
    else:
        raise ValueError(f"Unknown action: {action}")

    after = enrich_resource(after_res, pricing, carbon)

    return {
        "resource_id": resource["id"],
        "action": action,
        "before": {
            "monthly_cost_usd": before["monthly_cost_usd"],
            "monthly_kg_co2": before["monthly_kg_co2"],
            "region": before["region"],
            "instance_type": before["instance_type"],
        },
        "after": {
            "monthly_cost_usd": after["monthly_cost_usd"],
            "monthly_kg_co2": after["monthly_kg_co2"],
            "region": after["region"],
            "instance_type": after["instance_type"],
        },
        "savings_usd": round(before["monthly_cost_usd"] - after["monthly_cost_usd"], 2),
        "savings_kg_co2": round(before["monthly_kg_co2"] - after["monthly_kg_co2"], 3),
    }
