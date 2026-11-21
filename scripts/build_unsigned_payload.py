#!/usr/bin/env python3
"""Write the exact unsigned Studionet deploy transaction. Does not sign or broadcast."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from genlayer_py.consensus.consensus_main.encoder import (
    encode_add_transaction_data,
    encode_tx_data_deploy,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts" / "git_escrow_court.py"
CONSENSUS = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575"
SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9"
ZERO = "0x0000000000000000000000000000000000000000"


def main() -> None:
    raise SystemExit("use node --experimental-strip-types scripts/write-payloads.ts; the six-argument encoder is not the primary path")
    code = SOURCE.read_text(encoding="utf-8")
    source_sha256 = hashlib.sha256(code.encode("utf-8")).hexdigest()
    tx_data = encode_tx_data_deploy(code, False, [], {})
    data = encode_add_transaction_data(SENDER, ZERO, 5, 3, tx_data, 0)
    payload = {
        "purpose": "Deploy GitEscrowCourt on Studionet by addTransaction. Value is zero.",
        "signed": False,
        "broadcast": False,
        "chainId": 61999,
        "chainIdHex": "0xf22f",
        "rpc": "https://studio.genlayer.com/api",
        "from": SENDER,
        "to": CONSENSUS,
        "value": "0x0",
        "data": data,
        "selector": data[:10],
        "method": "addTransaction(address,address,uint256,uint256,bytes,uint256)",
        "arguments": {
            "sender": SENDER,
            "recipient": ZERO,
            "numOfInitialValidators": 5,
            "maxRotations": 3,
            "validUntil": 0,
            "leaderOnly": False,
            "constructorArguments": [],
        },
        "contract": "contracts/git_escrow_court.py",
        "sourceSha256": source_sha256,
        "runner": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6",
        "calldataBytes": (len(data) - 2) // 2,
        "observedEstimateGas": "0x7a120",
        "observedGasPriceWei": "0",
        "feeCapWei": "1000000000000000",
        "feeCap": "0.001 test GEN",
        "allowlist": [61999],
        "ethSendTransaction": "only inside the button labeled 请 MetaMask 签名部署",
        "readback": [
            "After the wallet returns a hash, read eth_getTransactionReceipt on https://studio.genlayer.com/api.",
            "Read the GenLayer transaction with that hash. Treat it as a deploy only when consensus_data.leader_receipt[0].execution_result is SUCCESS.",
            "The contract address is data.contract_address on that GenLayer transaction. eth_getCode on Studionet can be 0x even then; use gen_getContractSchema.",
            "Then call get_record only after a separate explicit review_case transaction. This file does not include that second signature.",
        ],
        "consensusCodeNote": "eth_getCode for the official Studio consensus address currently returns 0x, and eth_call of an arbitrary selector returns 0x1. estimateGas for this addTransaction returned 0x7a120. Do not treat empty code as a second consensus address.",
    }
    out = ROOT / "fixtures" / "public" / "unsigned-deploy.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(source_sha256, payload["selector"], payload["calldataBytes"])


if __name__ == "__main__":
    main()
