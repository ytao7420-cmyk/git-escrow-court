"""Canonical hashing shared by the fixture builder and the local tests.

The intelligent contract repeats these exact json.dumps settings. If they
drift, a correct fixture is judged as a freeze-hash mismatch.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def evidence_body(partner_input: dict[str, Any]) -> dict[str, Any]:
    return {
        "receipt": partner_input["receipt"],
        "testResult": partner_input.get("testResult", None),
    }


def freeze_for(case: dict[str, Any]) -> dict[str, str]:
    return {
        "mandateHash": sha256_text(canonical_json(case["mandate"])),
        "rubricHash": sha256_text(canonical_json(case["rubric"])),
        "evidenceHash": sha256_text(canonical_json(evidence_body(case["partnerInput"]))),
        "algorithm": "sha256",
    }
