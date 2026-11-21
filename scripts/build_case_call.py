#!/usr/bin/env python3
"""Freeze the one public Base Sepolia case and encode review_case.

The contract source is not modified. testResult stays null, so the frozen
contract escalates instead of continuing. This script does not sign or send.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from genlayer_py.consensus.consensus_main.encoder import (
    encode_add_transaction_data,
    encode_tx_data_call,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from court.public_case import case_from_fulfillment  # noqa: E402

UID = "0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b"
SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9"
CONSENSUS = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575"
SOURCE_SHA = "4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e"


def load_record() -> dict:
    snapshot = json.loads((ROOT / "fixtures" / "public" / "arkhai-public-read.json").read_text(encoding="utf-8"))
    return next(item for item in snapshot["fulfillments"] if item["uid"] == UID)


def argument_text() -> str:
    return json.dumps(case_from_fulfillment(load_record()), ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def inner_tx_data() -> str:
    return encode_tx_data_call("review_case", False, [argument_text()], None)


def outer_calldata(contract_address: str) -> str:
    raise SystemExit("use the genlayer-js five-argument encoder in src/lib/official-primary.ts")
    if not (isinstance(contract_address, str) and contract_address.startswith("0x") and len(contract_address) == 42):
    if not (isinstance(contract_address, str) and contract_address.startswith("0x") and len(contract_address) == 42):
        raise ValueError("contract address must be 0x plus 40 hex characters")
    return encode_add_transaction_data(SENDER, contract_address, 5, 3, inner_tx_data(), 0)


def main() -> None:
    raise SystemExit("case outer calldata is encoded by genlayer-js 1.1.8 in scripts/write-payloads.ts")
    source = (ROOT / "contracts" / "git_escrow_court.py").read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != SOURCE_SHA:
        raise SystemExit("contract source hash changed; refuse to build a call for a different deploy")
    text = argument_text()
    case = json.loads(text)
    if case["partnerInput"]["testResult"] is not None:
        raise SystemExit("refusing to freeze a fabricated test log")
    payload = {
        "purpose": "One review_case of a third-party Base Sepolia fulfillment. Expected decision is escalate.",
        "signed": False,
        "broadcast": False,
        "contractSourceSha256": digest,
        "expectedDecision": "escalate",
        "expectedViolation": "missing-test-result",
        "thirdParty": True,
        "hostedCourtCase": False,
        "caseId": case["caseId"],
        "attestationUid": UID,
        "baseSepoliaTx": case["execution"]["txHash"],
        "argumentSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "argument": json.loads(text),
        "innerTxDataSha256": hashlib.sha256(bytes.fromhex(inner_tx_data()[2:])).hexdigest(),
        "method": "review_case",
        "chainId": 61999,
        "value": "0x0",
        "consensus": CONSENSUS,
        "from": SENDER,
        "feeCapWei": "1000000000000000",
        "recipientNote": "addTransaction recipient is the deployed GitEscrowCourt address, supplied after the deploy hash is known.",
    }
    out = ROOT / "fixtures" / "public" / "case-submit.json"
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    if len(sys.argv) == 2:
        data = outer_calldata(sys.argv[1])
        print(json.dumps({"to": CONSENSUS, "from": SENDER, "value": "0x0", "data": data, "selector": data[:10]}))
    else:
        print(payload["caseId"], payload["argumentSha256"], payload["innerTxDataSha256"])


if __name__ == "__main__":
    main()
