import hashlib
import json
from pathlib import Path

from court.canonical import evidence_body, freeze_for, sha256_text

ROOT = Path(__file__).resolve().parents[2]


def test_committed_cases_match_the_canonical_freeze():
    for name in ("pass", "warn", "constrain", "revoke", "escalate"):
        case = json.loads((ROOT / "fixtures" / "cases" / f"{name}.json").read_text(encoding="utf-8"))
        assert case["freeze"] == freeze_for(case)
        assert case["partnerInput"]["receipt"]["tests-repo"].endswith("bounty-tests")
        assert len(case["partnerInput"]["receipt"]["tests-commit"]) == 40
        result = case["partnerInput"]["testResult"]
        if name == "escalate":
            assert result is None
            continue
        assert result["logSha256"] == sha256_text(result["log"])
        assert result["rawSha256"] == hashlib.sha256(result["rawLog"].encode("utf-8")).hexdigest()
        assert result["caseId"] == case["caseId"]
        body = evidence_body(case["partnerInput"])
        assert body["receipt"]["tests-commit"] == case["partnerInput"]["receipt"]["tests-commit"]
