#!/usr/bin/env python3
"""Deploy the court in the GenLayer direct VM and read one judgment back.

stdin: {"scenario": "pass"} or {"scenario": "rename"}.
stdout: one JSON object. This does not sign a transaction or call a hosted court.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from gltest.direct.loader import create_address, deploy_contract  # noqa: E402
from gltest.direct.vm import VMContext  # noqa: E402

SCENARIOS = {
    "pass": "pass",
    "warn": "warn",
    "constrain": "constrain",
    "revoke": "revoke",
    "escalate": "escalate",
    "rename": "pass",
    "preset": "pass",
    "tamper": "pass",
    "live-claim": "pass",
    "repeat": "pass",
}


def load_case(name: str) -> dict:
    return json.loads((ROOT / "fixtures" / "cases" / (name + ".json")).read_text(encoding="utf-8"))


def mutate(scenario: str, case: dict) -> dict:
    if scenario == "rename":
        case["partnerInput"]["receipt"]["release-diff"] = "not-a-git-escrow-trade"
    elif scenario == "preset":
        case["decision"] = "TRUE"
    elif scenario == "tamper":
        commit = case["partnerInput"]["receipt"]["tests-commit"]
        case["partnerInput"]["receipt"]["tests-commit"] = ("0" if commit[:1] != "0" else "1") + commit[1:]
    elif scenario == "live-claim":
        case["execution"]["publicTestnetReceipt"] = True
        case["execution"]["mode"] = "public-testnet"
    return case


def case_for_public_uid(uid: str) -> dict:
    snapshot = json.loads((ROOT / "fixtures" / "public" / "arkhai-public-read.json").read_text(encoding="utf-8"))
    match = next((item for item in snapshot.get("fulfillments", []) if item.get("uid") == uid), None)
    if match is None:
        raise ValueError("uid is not in the public read snapshot")
    from court.public_case import case_from_fulfillment

    return case_from_fulfillment(match)


def run(scenario: str, public_uid: str | None = None) -> dict:
    if public_uid:
        try:
            case = case_for_public_uid(public_uid)
        except Exception as caught:
            return {"ok": False, "mode": "public-read", "scenario": scenario, "error": str(caught)}
    elif scenario not in SCENARIOS:
        return {"ok": False, "error": "unknown scenario", "mode": "local-fixture"}
    else:
        case = mutate(scenario, load_case(SCENARIOS[scenario]))
    if scenario == "repeat":
        case["caseId"] = case["caseId"] + "-repeat"
        case["partnerInput"]["receipt"]["caseId"] = case["caseId"]
        if case["partnerInput"]["testResult"] is not None:
            case["partnerInput"]["testResult"]["caseId"] = case["caseId"]
        from court.canonical import freeze_for

        case["freeze"] = freeze_for(case)
    vm = VMContext()
    vm.sender = create_address("default_sender")
    with vm.activate():
        contract = deploy_contract(ROOT / "contracts" / "git_escrow_court.py", vm)
        try:
            raw = contract.review_case(json.dumps(case))
            record = json.loads(raw)
            if scenario == "repeat":
                try:
                    contract.review_case(json.dumps(case))
                    return {"ok": False, "error": "second write unexpectedly stored", "mode": "local-direct-vm"}
                except Exception as second:
                    record["repeatRefused"] = str(second)
            return {
                "ok": True,
                "mode": case.get("execution", {}).get("mode", "local-direct-vm"),
                "scenario": scenario,
                "record": record,
            }
        except Exception as caught:
            return {
                "ok": False,
                "mode": "local-direct-vm",
                "scenario": scenario,
                "error": str(caught),
            }


def main() -> None:
    payload = json.loads(sys.stdin.read() or '{"scenario":"pass"}')
    scenario = payload.get("scenario", "pass")
    public_uid = payload.get("uid") if scenario == "public-fulfillment" else None
    json.dump(run(scenario, public_uid), sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
