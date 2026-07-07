"""Learning-path curriculum logic — unlock ordering and mastery gates.

Pure functions over attempt rows, so no Firestore/LLM needed.
"""
from app import curriculum as c


def _row(module_id=None, **scores):
    base = {
        "module_id": module_id,
        "rapport": 0,
        "discovery": 0,
        "product_knowledge": 0,
        "objection_handling": 0,
        "closing": 0,
        "overall_score": 0,
    }
    base.update(scores)
    return base


def test_empty_path_only_first_unlocked():
    p = c.build_path([])
    assert p["total_modules"] == len(c.MODULES)
    assert p["passed_modules"] == 0
    assert p["percent_complete"] == 0
    assert not p["completed"]
    mods = p["modules"]
    assert mods[0]["unlocked"] and not mods[0]["passed"]
    assert not mods[1]["unlocked"]
    assert p["next_module_id"] == mods[0]["id"]


def test_passing_a_module_unlocks_the_next():
    first = sorted(c.MODULES, key=lambda m: m["order"])[0]
    gate = first["gate"]
    rows = [_row(module_id=first["id"], **{gate["dimension"]: gate["min_score"]})]
    p = c.build_path(rows)
    assert p["passed_modules"] == 1
    assert p["modules"][0]["passed"]
    assert p["modules"][1]["unlocked"]
    assert p["next_module_id"] == p["modules"][1]["id"]


def test_unstamped_high_score_does_not_complete_a_module():
    # A great free-roleplay attempt (no module_id) must not clear the gate.
    rows = [_row(
        module_id=None,
        rapport=10, discovery=10, product_knowledge=10,
        objection_handling=10, closing=10, overall_score=10,
    )]
    p = c.build_path(rows)
    assert p["passed_modules"] == 0


def test_overall_min_gate_is_enforced():
    final = next(m for m in c.MODULES if m["gate"].get("overall_min"))
    g = final["gate"]
    # Dimension bar met, overall bar not met → not passed.
    below = [_row(module_id=final["id"], **{g["dimension"]: g["min_score"], "overall_score": g["overall_min"] - 1})]
    assert not c.build_path(below)["modules"][-1]["passed"]
    # Both bars met → passed.
    ok = [_row(module_id=final["id"], **{g["dimension"]: g["min_score"], "overall_score": g["overall_min"]})]
    assert c.build_path(ok)["modules"][-1]["passed"]


def test_best_score_and_attempts_tracked_per_module():
    first = sorted(c.MODULES, key=lambda m: m["order"])[0]
    dim = first["gate"]["dimension"]
    rows = [
        _row(module_id=first["id"], **{dim: 4}),
        _row(module_id=first["id"], **{dim: 6}),
    ]
    m0 = c.build_path(rows)["modules"][0]
    assert m0["attempts"] == 2
    assert m0["best_score"] == 6
    assert not m0["passed"]  # 6 < gate (7)
