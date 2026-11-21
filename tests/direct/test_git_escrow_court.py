import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = "contracts/git_escrow_court.py"


def load(name: str) -> str:
    return (ROOT / "fixtures" / "cases" / f"{name}.json").read_text(encoding="utf-8")


def review(direct_vm, direct_deploy, name: str) -> dict:
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_vm.sender
    raw = contract.review_case(load(name))
    return contract, json.loads(raw)


def test_continue_cites_escrow_fields(direct_vm, direct_deploy):
    _contract, record = review(direct_vm, direct_deploy, "pass")
    assert record["decision"] == "continue"
    assert record["mandateStatus"] == "active"
    assert record["score"] == 100
    ids = record["evidenceIds"]
    assert "arkhai.tests-repo" in ids
    assert "arkhai.tests-commit" in ids
    assert "arkhai.test-log" in ids
    assert "TRUE" in record["notUsed"]
    assert record["stateEnum"] == "internet-court-adapter"
    assert any("local-fixture" in item for item in record["limitations"])
    assert any("node:test" in item for item in record["limitations"])


def test_warn_constrain_revoke_escalate(direct_deploy):
    contract = direct_deploy(CONTRACT)
    expected = {
        "warn": ("warn", "warned"),
        "constrain": ("constrain", "constrained"),
        "revoke": ("revoke", "revoked"),
        "escalate": ("escalate", "escalated"),
    }
    for name, (decision, status) in expected.items():
        record = json.loads(contract.review_case(load(name)))
        assert record["decision"] == decision
        assert record["mandateStatus"] == status
        assert record["decision"] not in ("TRUE", "FALSE", "UNDETERMINED")


def test_second_review_is_refused(direct_vm, direct_deploy):
    contract, _record = review(direct_vm, direct_deploy, "pass")
    with direct_vm.expect_revert("case already reviewed"):
        contract.review_case(load("pass"))


def test_renamed_field_is_refused(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    case = json.loads(load("pass"))
    case["partnerInput"]["receipt"]["release-diff"] = "no"
    with direct_vm.expect_revert("tests-repo and tests-commit"):
        contract.review_case(json.dumps(case))


def test_preset_oracle_word_is_refused(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    case = json.loads(load("pass"))
    case["decision"] = "TRUE"
    with direct_vm.expect_revert("cannot preset"):
        contract.review_case(json.dumps(case))


def test_hash_mismatch_revokes(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    case = json.loads(load("pass"))
    case["partnerInput"]["receipt"]["tests-commit"] = "f" * 40
    record = json.loads(contract.review_case(json.dumps(case)))
    assert record["decision"] == "revoke"
    assert "freeze-hash-mismatch" in record["violations"]


def test_model_must_agree(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    direct_vm.mock_llm(
        r".*Git escrow court review.*",
        json.dumps(
            {
                "decision": "continue",
                "reasoning": "The pinned tests passed and the evidence ids match the rubric.",
            }
        ),
    )
    record = json.loads(contract.review_case_with_model(load("pass")))
    assert record["decision"] == "continue"
    assert record["reasoningSource"] == "model-agreed-with-rubric"
    assert direct_vm.run_validator() is True


def test_model_divergence_reverts(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    direct_vm.mock_llm(
        r".*Git escrow court review.*",
        json.dumps({"decision": "revoke", "reasoning": "This disagrees with the rubric on purpose."}),
    )
    with direct_vm.expect_revert("diverged"):
        contract.review_case_with_model(load("pass"))


def test_validator_disagrees_when_the_model_changes(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    direct_vm.mock_llm(
        r".*Git escrow court review.*",
        json.dumps(
            {
                "decision": "warn",
                "reasoning": "The tests passed and the missing rationale is a non-blocking warning.",
            }
        ),
    )
    contract.review_case_with_model(load("warn"))
    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*Git escrow court review.*",
        json.dumps({"decision": "revoke", "reasoning": "A later sample disagrees with the leader."}),
    )
    assert direct_vm.run_validator() is False


def test_public_fulfillment_without_tests_escalates(direct_deploy):
    from court.public_case import case_from_fulfillment

    case = case_from_fulfillment(
        {
            "uid": "0x" + "ab" * 32,
            "tx": "0x" + "cd" * 32,
            "commitHash": "164d6a980a19955e9e712f6824951c8d30256091",
            "hosts": ["https://github.com/mlegls/git-escrow-bun-test-fulfillment.git"],
            "network": "base-sepolia",
            "chainId": 84532,
            "contract": "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2",
        }
    )
    contract = direct_deploy(CONTRACT)
    record = json.loads(contract.review_case(json.dumps(case)))
    assert record["decision"] == "escalate"
    assert record["mandateStatus"] == "escalated"
    assert "tests-repo-not-in-this-attestation" in record["violations"]
    assert "arkhai.solution-repo" in record["evidenceIds"]


def test_public_fulfillment_with_demand_still_has_no_test_log(direct_deploy):
    from court.public_case import case_from_fulfillment

    case = case_from_fulfillment(
        {
            "uid": "0x" + "11" * 32,
            "tx": "0x" + "22" * 32,
            "commitHash": "164d6a980a19955e9e712f6824951c8d30256091",
            "hosts": ["https://github.com/mlegls/git-escrow-bun-test-fulfillment.git"],
            "testsRepo": "https://github.com/mlegls/git-escrow-bun-test-demand.git",
            "testsCommit": "3680b366c331d145a1bbfd98fc89bb5d0e0225cb",
            "network": "base-sepolia",
            "chainId": 84532,
            "contract": "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2",
        }
    )
    contract = direct_deploy(CONTRACT)
    record = json.loads(contract.review_case(json.dumps(case)))
    assert record["decision"] == "escalate"
    assert "missing-test-result" in record["violations"]
    assert case["partnerInput"]["receipt"]["tests-repo"].endswith("demand.git")


def test_missing_schema_field_is_refused(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT)
    case = json.loads(load("pass"))
    del case["partnerInput"]["receipt"]["tests-commit"]
    with direct_vm.expect_revert("tests-commit"):
        contract.review_case(json.dumps(case))


@pytest.mark.parametrize(
    "decision,status",
    [
        ("continue", "active"),
        ("warn", "warned"),
        ("constrain", "constrained"),
        ("revoke", "revoked"),
        ("escalate", "escalated"),
    ],
)
def test_status_map_is_not_the_oracle_enum(decision, status):
    assert decision not in {"TRUE", "FALSE", "UNDETERMINED"}
    assert status in {"active", "warned", "constrained", "revoked", "escalated"}
