"""Build one court case from a decoded public CommitObligation attestation.

The test suite is not inside that attestation. The sentinel
``absent-from-commit-obligation`` keeps the field name and forces escalate.
It is not a guessed tests-repo.
"""

from __future__ import annotations

from typing import Any

from court.canonical import freeze_for

ABSENT = "absent-from-commit-obligation"

SCHEMA = {
    "commitObligation": "string commitHash,uint8 commitAlgo,string[] hosts",
    "source": "CommitObligation.getSchema on the network named in the receipt",
}


def case_from_fulfillment(record: dict[str, Any]) -> dict[str, Any]:
    hosts = record.get("hosts") or []
    if not hosts or not isinstance(hosts[0], str) or not hosts[0]:
        raise ValueError("attestation has no host")
    commit = record.get("commitHash")
    tx_hash = record.get("tx")
    uid = record.get("uid")
    if not isinstance(commit, str) or not commit:
        raise ValueError("attestation has no commitHash")
    if not isinstance(tx_hash, str) or len(tx_hash) != 66:
        raise ValueError("attestation has no transaction hash")
    if not isinstance(uid, str) or not uid.startswith("0x"):
        raise ValueError("attestation has no uid")
    case_id = "public-" + uid[2:14]
    case: dict[str, Any] = {
        "caseId": case_id,
        "execution": {
            "mode": "public-read",
            "hostedCourtCase": False,
            "publicTestnetReceipt": True,
            "txHash": tx_hash,
            "createdByThisProject": False,
        },
        "mandate": {
            "id": "mandate-public-fulfillment",
            "objective": "Read one public git-escrow fulfillment and say whether the same attestation also contains the tests-repo.",
            "authoritySummary": "Read-only. Do not collect the escrow and do not claim the attestation was created here.",
            "prohibitedActions": [
                "rename tests-repo or tests-commit",
                "invent a tests-repo that is not in the attestation",
                "claim an Internet Court hosted case id",
            ],
        },
        "rubric": [
            "evidence: solution-repo and solution-commit come from CommitObligation hosts and commitHash",
            "evidence: tests-repo stays absent when the attestation does not contain it",
            "result: a fulfillment alone cannot count as a passed test suite",
        ],
        "partnerInput": {
            "partner": "arkhai",
            "interface": "git-escrows",
            "receipt": {
                "caseId": case_id,
                "source": "public-attestation",
                "network": record.get("network"),
                "chainId": str(record.get("chainId")),
                "tests-repo": record.get("testsRepo") or ABSENT,
                "tests-commit": record.get("testsCommit") or ABSENT,
                "solution-repo": hosts[0],
                "solution-commit": commit,
                "escrow-uid": record.get("refUID") or ABSENT,
                "fulfillment-uid": uid,
                "attester": record.get("attester") or ABSENT,
                "recipient": record.get("recipient") or ABSENT,
                "schemaUid": record.get("schemaUid") or ABSENT,
                "reward": record.get("amount") or ABSENT,
                "token": record.get("token") or ABSENT,
                "oracle": record.get("oracle") or "not-asserted-by-this-commit-obligation",
                "arbiter": record.get("escrowArbiter") or record.get("contract") or ABSENT,
                "schema": SCHEMA,
                "commitAlgo": str(record.get("commitAlgo")),
            },
            "testResult": None,
        },
    }
    case["freeze"] = freeze_for(case)
    return case
