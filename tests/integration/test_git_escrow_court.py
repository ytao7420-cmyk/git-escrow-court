import json
from pathlib import Path

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.clients import get_gl_client
from gltest.utils import extract_contract_address

ROOT = Path(__file__).resolve().parents[2]


def test_local_consensus_reads_continue_and_revoke():
    """GLSim consensus. gltest's method binder reads schema after deploy, and
    this GLSim build then returns an empty method map, so the calls go through
    the GenLayer client by method name."""
    factory = get_contract_factory(contract_file_path="git_escrow_court.py")
    client = get_gl_client()
    deploy_receipt = factory.deploy_contract_tx(args=[])
    assert tx_execution_succeeded(deploy_receipt)
    address = extract_contract_address(deploy_receipt)

    for name, decision in (("pass", "continue"), ("revoke", "revoke")):
        raw = (ROOT / "fixtures" / "cases" / f"{name}.json").read_text(encoding="utf-8")
        case_id = json.loads(raw)["caseId"]
        tx_hash = client.write_contract(
            address=address,
            function_name="review_case",
            args=[raw],
        )
        write_receipt = client.wait_for_transaction_receipt(transaction_hash=tx_hash)
        assert tx_execution_succeeded(write_receipt)
        stored = client.read_contract(
            address=address,
            function_name="get_record",
            args=[case_id],
        )
        record = json.loads(stored) if isinstance(stored, str) else stored
        assert record["decision"] == decision
        assert "arkhai.tests-repo" in record["evidenceIds"]
        assert "arkhai.tests-commit" in record["evidenceIds"]
        assert record["decision"] not in ("TRUE", "FALSE", "UNDETERMINED")
