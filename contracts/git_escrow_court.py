# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import hashlib
import json

from genlayer import *


class GitEscrowCourt(gl.Contract):
    """Review one Arkhai git-escrow delivery against a frozen mandate.

    Decisions are only continue, warn, constrain, revoke, and escalate.
    TRUE, FALSE, and UNDETERMINED are refused if a caller tries to preset them.
    """

    owner: Address
    records: TreeMap[str, str]
    order: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_record(self, case_id: str) -> str:
        return self.records[case_id]

    @gl.public.view
    def list_cases(self) -> str:
        return json.dumps(list(self.order))

    @gl.public.write
    def review_case(self, case_json: str) -> str:
        record = self._settle(case_json, reasoning_source="deterministic-rubric")
        self._store(record)
        return json.dumps(record)

    @gl.public.write
    def review_case_with_model(self, case_json: str) -> str:
        draft = self._settle(case_json, reasoning_source="pending-model")

        def leader():
            prompt = (
                "Git escrow court review. Reply with JSON keys decision and reasoning. "
                "decision must be exactly "
                + draft["decision"]
                + ". Cite evidence ids "
                + ",".join(draft["evidenceIds"])
                + ". Do not answer TRUE, FALSE, or UNDETERMINED."
            )
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = _parse_model(raw)
            if parsed["decision"] != draft["decision"]:
                raise gl.vm.UserError(
                    "[LLM_ERROR] model decision diverged from rubric"
                )
            agreed = dict(draft)
            agreed["reasoning"] = parsed["reasoning"]
            agreed["reasoningSource"] = "model-agreed-with-rubric"
            return agreed

        def validator(leaders_res):
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader)
            try:
                again = leader()
            except gl.vm.UserError:
                return False
            return (
                again["decision"] == leaders_res.calldata["decision"]
                and again["evidenceHash"] == leaders_res.calldata["evidenceHash"]
            )

        agreed = gl.vm.run_nondet_unsafe(leader, validator)
        self._store(agreed)
        return json.dumps(agreed)

    def _store(self, record: dict) -> None:
        case_id = record["caseId"]
        self.records[case_id] = json.dumps(record)
        self.order.append(case_id)

    def _settle(self, case_json: str, reasoning_source: str) -> dict:
        case = json.loads(case_json)
        if not isinstance(case, dict):
            raise gl.vm.UserError("[EXPECTED] case must be an object")
        _refuse_structure(case)
        case_id = case.get("caseId")
        if not isinstance(case_id, str) or len(case_id) < 3:
            raise gl.vm.UserError("[EXPECTED] caseId missing")
        for existing in self.order:
            if existing == case_id:
                raise gl.vm.UserError("[EXPECTED] case already reviewed")

        partner = case.get("partnerInput")
        if not isinstance(partner, dict):
            raise gl.vm.UserError("[EXPECTED] partnerInput missing")
        if partner.get("partner") != "arkhai" or partner.get("interface") != "git-escrows":
            raise gl.vm.UserError("[EXPECTED] partner input is not arkhai git-escrows")
        receipt = partner.get("receipt")
        if not isinstance(receipt, dict):
            raise gl.vm.UserError("[EXPECTED] receipt missing")
        _require_receipt(receipt)
        if receipt.get("caseId") != case_id:
            raise gl.vm.UserError("[EXPECTED] receipt caseId differs from the case")

        decision, violations, test_state = _rubric(partner, case_id)
        claimed = case.get("freeze") if isinstance(case.get("freeze"), dict) else {}
        evidence = {"receipt": receipt, "testResult": partner.get("testResult", None)}
        recomputed = {
            "mandateHash": _sha256(_canonical(case.get("mandate"))),
            "rubricHash": _sha256(_canonical(case.get("rubric"))),
            "evidenceHash": _sha256(_canonical(evidence)),
            "algorithm": "sha256",
        }
        if (
            claimed.get("mandateHash") != recomputed["mandateHash"]
            or claimed.get("rubricHash") != recomputed["rubricHash"]
            or claimed.get("evidenceHash") != recomputed["evidenceHash"]
        ):
            if "freeze-hash-mismatch" not in violations:
                violations.append("freeze-hash-mismatch")
            decision = "revoke"
            test_state = test_state + "+freeze-mismatch"

        status = {
            "continue": "active",
            "warn": "warned",
            "constrain": "constrained",
            "revoke": "revoked",
            "escalate": "escalated",
        }[decision]
        score = {"continue": 100, "warn": 75, "constrain": 40, "revoke": 0, "escalate": 0}[
            decision
        ]
        refs = [
            {"id": "arkhai.tests-repo", "value": receipt.get("tests-repo")},
            {"id": "arkhai.tests-commit", "value": receipt.get("tests-commit")},
            {"id": "arkhai.solution-repo", "value": receipt.get("solution-repo")},
            {"id": "arkhai.solution-commit", "value": receipt.get("solution-commit")},
            {"id": "arkhai.escrow-uid", "value": receipt.get("escrow-uid")},
            {"id": "arkhai.fulfillment-uid", "value": receipt.get("fulfillment-uid")},
            {"id": "freeze.mandate", "sha256": recomputed["mandateHash"]},
            {"id": "freeze.rubric", "sha256": recomputed["rubricHash"]},
            {"id": "freeze.evidence", "sha256": recomputed["evidenceHash"]},
        ]
        test_result = partner.get("testResult", None)
        if isinstance(test_result, dict):
            refs.append({"id": "arkhai.test-log", "sha256": test_result.get("logSha256")})
        ref_ids = []
        for item in refs:
            ref_ids.append(item["id"])

        limitations = [
            "Court decisions are continue, warn, constrain, revoke, or escalate.",
            "TRUE, FALSE, and UNDETERMINED are not court decisions and are not stored as one.",
            "This judgment does not move tokens, collect an escrow, or revoke an ERC-7710 delegation.",
            "No Internet Court hosted case id was created. api.internetcourt.org was not called.",
            "A self-deployed or local GenLayer execution is not the hosted court service.",
        ]
        execution = case.get("execution") if isinstance(case.get("execution"), dict) else {}
        if execution.get("mode") == "local-fixture":
            limitations.append(
                "execution.mode is local-fixture. This record is not a public testnet receipt."
            )
        if execution.get("mode") == "public-read":
            limitations.append(
                "This input is a public third-party attestation. This project did not create it, and it is not an Internet Court hosted case."
            )
        if isinstance(test_result, dict) and test_result.get("runner") == "local-node-test":
            limitations.append(
                "The test log was produced by this repository's local node:test runner, not by a public Arkhai oracle container."
            )
        if decision == "escalate":
            limitations.append("The score is not a quality score. Evidence was insufficient to settle.")

        reasoning = (
            "Rubric settlement is "
            + decision
            + " ("
            + status
            + ") for case "
            + case_id
            + ". Test state "
            + test_state
            + ". Evidence refs "
            + ", ".join(ref_ids)
            + "."
        )
        return {
            "caseId": case_id,
            "decision": decision,
            "mandateStatus": status,
            "score": score,
            "reasoning": reasoning,
            "reasoningSource": reasoning_source,
            "violations": violations,
            "evidenceRefs": refs,
            "evidenceIds": ref_ids,
            "limitations": limitations,
            "claimedFreeze": claimed,
            "recomputedFreeze": recomputed,
            "evidenceHash": recomputed["evidenceHash"],
            "reviewedActionIds": [
                "escrow:" + str(receipt.get("escrow-uid")),
                "fulfillment:" + str(receipt.get("fulfillment-uid")),
                "tests-commit:" + str(receipt.get("tests-commit")),
            ],
            "stateEnum": "internet-court-adapter",
            "notUsed": ["TRUE", "FALSE", "UNDETERMINED"],
        }


def _canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _refuse_structure(case: dict) -> None:
    execution = case.get("execution")
    if not isinstance(execution, dict):
        raise gl.vm.UserError("[EXPECTED] execution block missing")
    if execution.get("hostedCourtCase") is True:
        raise gl.vm.UserError("[EXPECTED] hosted court case id cannot be claimed here")
    if execution.get("publicTestnetReceipt") is True:
        tx_hash = execution.get("txHash")
        if not isinstance(tx_hash, str) or not _is_tx_hash(tx_hash):
            raise gl.vm.UserError(
                "[EXPECTED] public testnet receipt requires a transaction hash"
            )
    for key in ("decision", "courtDecision", "verdict"):
        if key in case:
            raise gl.vm.UserError("[EXPECTED] caller cannot preset the court decision")
    keys = []
    _collect_keys(case, keys)
    for key in keys:
        if key in ("releaseDiff", "release-diff", "release_diff"):
            raise gl.vm.UserError(
                "[EXPECTED] release-diff is not a git-escrow field; keep tests-repo and tests-commit"
            )


def _is_tx_hash(value: str) -> bool:
    if len(value) != 66 or not value.startswith("0x"):
        return False
    hexdigits = "0123456789abcdefABCDEF"
    for char in value[2:]:
        if char not in hexdigits:
            return False
    return True


def _collect_keys(value, keys) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            keys.append(key)
            _collect_keys(item, keys)
    elif isinstance(value, list):
        for item in value:
            _collect_keys(item, keys)


def _require_receipt(receipt: dict) -> None:
    required = (
        "tests-repo",
        "tests-commit",
        "solution-repo",
        "solution-commit",
        "escrow-uid",
        "fulfillment-uid",
        "caseId",
        "reward",
        "token",
        "oracle",
        "arbiter",
        "schema",
    )
    for key in required:
        if key not in receipt:
            raise gl.vm.UserError("[EXPECTED] receipt missing " + key)
        if key != "schema" and (not isinstance(receipt[key], str) or len(receipt[key]) == 0):
            raise gl.vm.UserError("[EXPECTED] receipt field empty " + key)
    schema_text = _canonical(receipt["schema"])
    has_commit = "string commitHash,uint8 commitAlgo,string[] hosts" in schema_text
    has_tests = "(string testsCommitHash, uint8 testsCommitAlgo, string[] hosts)" in schema_text
    if not has_commit and not has_tests:
        raise gl.vm.UserError("[EXPECTED] receipt schema is not a git-escrow schema")


def _rubric(partner: dict, case_id: str):
    receipt = partner.get("receipt") if isinstance(partner.get("receipt"), dict) else {}
    if (
        receipt.get("tests-repo") == "absent-from-commit-obligation"
        or receipt.get("tests-commit") == "absent-from-commit-obligation"
    ):
        return "escalate", ["tests-repo-not-in-this-attestation"], "fulfillment-only"
    test_result = partner.get("testResult", None)
    if test_result is None:
        return "escalate", ["missing-test-result"], "absent"
    if not isinstance(test_result, dict):
        return "escalate", ["test-result-not-object"], "absent"
    if test_result.get("caseId") != case_id:
        return "escalate", ["test-result-case-mismatch"], "mismatch"
    log = test_result.get("log")
    if not isinstance(log, str) or test_result.get("logSha256") != _sha256(log):
        return "revoke", ["test-log-hash-mismatch"], "tampered"
    raw = test_result.get("rawLog")
    if isinstance(raw, str) and test_result.get("rawSha256") != _sha256(raw):
        return "revoke", ["test-raw-log-hash-mismatch"], "tampered"
    if test_result.get("passed") is not True:
        return "revoke", ["tests-failed"], "failed"
    runner = test_result.get("runner")
    if runner not in ("local-node-test", "arkhai-oracle"):
        return "escalate", ["unknown-test-runner"], "unknown-runner"
    if test_result.get("unlimitedApproval") is True:
        return "constrain", ["unlimited-token-approval"], "passed"
    warnings = test_result.get("warnings")
    if isinstance(warnings, list) and len(warnings) > 0:
        return "warn", ["nonblocking-warning"], "passed"
    return "continue", [], "passed"


def _parse_model(raw):
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        raise gl.vm.UserError("[LLM_ERROR] model returned a non-object")
    decision = raw.get("decision")
    reasoning = raw.get("reasoning")
    allowed = ("continue", "warn", "constrain", "revoke", "escalate")
    if decision not in allowed:
        raise gl.vm.UserError("[LLM_ERROR] model decision is outside the court enum")
    if not isinstance(reasoning, str) or len(reasoning) < 8:
        raise gl.vm.UserError("[LLM_ERROR] model reasoning missing")
    return {"decision": decision, "reasoning": reasoning}


def _handle_leader_error(leaders_res, leader_fn) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as caught:
        validator_msg = caught.message if hasattr(caught, "message") else str(caught)
        if validator_msg.startswith("[EXPECTED]") or validator_msg.startswith("[EXTERNAL]"):
            return validator_msg == leader_msg
        if validator_msg.startswith("[TRANSIENT]") and leader_msg.startswith("[TRANSIENT]"):
            return True
        return False
    except Exception:
        return False
