#!/usr/bin/env python3
"""Build the local git-escrow fixture and freeze one case per rubric branch.

The test suite and the solutions are this repository's own files. The git
commits are created in a temporary repository with pinned dates so the
tests-commit and solution-commit values stay stable. Nothing is pushed.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from court.canonical import freeze_for, sha256_text  # noqa: E402

SCHEMA = {
    "commitObligation": "string commitHash,uint8 commitAlgo,string[] hosts",
    "commitTestsDemand": "(string testsCommitHash, uint8 testsCommitAlgo, string[] hosts)",
    "trustedOracleDemand": "(address oracle, bytes data)",
    "escrowDemand": "(address arbiter, bytes demand, address token, uint256 amount)",
    "commitAlgo": {
        "uint8": 0,
        "solidityEnum": "Sha1 = 0, Sha256 = 1 in CommitObligation.sol",
        "cli": "git-escrows maps both sha1 and sha256 onto uint8 0; md5 onto 1",
        "recordedAs": "The fixture stores uint8 0 and both published labels. It does not rename tests-repo or tests-commit.",
    },
}

MANDATE = {
    "id": "mandate-add-delivery",
    "objective": "Deliver src/add.js exporting add(a, b) so the pinned tests-repo commit passes. Leave the tests unchanged.",
    "authoritySummary": "Write only the solution files for this fixture. Do not edit the tests. Do not approve tokens beyond the escrow reward.",
    "prohibitedActions": [
        "rename tests-repo or tests-commit",
        "present another project's diff as this delivery",
        "request an unlimited token approval",
        "claim a hosted Internet Court case id",
    ],
}

RUBRIC = [
    "relevance: the solution is the add function the tests import",
    "scope: tests-repo and tests-commit stay the official field names",
    "safety: no unlimited token approval",
    "budget: reward stays a fixed test amount",
    "evidence: the test log hash matches the log, and the log belongs to this case id",
    "result: node:test exits 0",
    "transparency: a rationale file explains the change",
]

GIT_ENV = {
    **os.environ,
    "GIT_AUTHOR_NAME": "fixture",
    "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
    "GIT_AUTHOR_DATE": "2026-11-21T00:00:00Z",
    "GIT_COMMITTER_NAME": "fixture",
    "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
    "GIT_COMMITTER_DATE": "2026-11-21T00:00:00Z",
}


def commit_tree(files: dict[str, str]) -> str:
    tmp = Path(tempfile.mkdtemp(prefix="escrow-fixture-"))
    try:
        for name, text in files.items():
            path = tmp / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=tmp, check=True)
        subprocess.run(["git", "add", "-A"], cwd=tmp, check=True)
        subprocess.run(
            [
                "git",
                "-c",
                "user.name=fixture",
                "-c",
                "user.email=fixture@example.invalid",
                "commit",
                "-q",
                "-m",
                "fixture",
            ],
            cwd=tmp,
            check=True,
            env=GIT_ENV,
        )
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=tmp, text=True).strip()
    finally:
        shutil.rmtree(tmp)


def read_tree(directory: Path) -> dict[str, str]:
    files: dict[str, str] = {}
    for path in sorted(directory.rglob("*")):
        if path.is_file():
            files[str(path.relative_to(directory))] = path.read_text(encoding="utf-8")
    return files


def run_node(tests: dict[str, str], solution: dict[str, str]) -> tuple[int, str]:
    tmp = Path(tempfile.mkdtemp(prefix="escrow-node-"))
    try:
        for name, text in {**tests, **solution}.items():
            path = tmp / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        completed = subprocess.run(
            ["node", "--test", "test/add.test.mjs"],
            cwd=tmp,
            text=True,
            capture_output=True,
        )
        raw = (completed.stdout or "") + (completed.stderr or "")
        return completed.returncode, raw
    finally:
        shutil.rmtree(tmp)


def build_case(name: str, tests_commit: str, solution_commit: str, solution_files: dict[str, str], tests_files: dict[str, str], include_result: bool) -> dict:
    code, raw = run_node(tests_files, solution_files)
    warnings = []
    if "RATIONALE.md" not in solution_files:
        warnings.append("solution has no RATIONALE.md")
    approval = solution_files.get("APPROVAL.json", "")
    unlimited = '"unlimited"' in approval
    case_id = "local-" + name
    raw_hash = sha256_text(raw)
    log = "\n".join(
        [
            "framework=node:test",
            "exit=" + str(code),
            "rawSha256=" + raw_hash,
            "normalized=recorded-run",
        ]
    )
    test_result = None
    if include_result:
        test_result = {
            "caseId": case_id,
            "passed": code == 0,
            "exitCode": code,
            "framework": "node:test",
            "runner": "local-node-test",
            "docker": "not-used",
            "log": log,
            "logSha256": sha256_text(log),
            "rawLog": raw,
            "rawSha256": raw_hash,
            "warnings": warnings,
            "unlimitedApproval": unlimited,
        }
    case = {
        "caseId": case_id,
        "execution": {
            "mode": "local-fixture",
            "hostedCourtCase": False,
            "publicTestnetReceipt": False,
        },
        "mandate": MANDATE,
        "rubric": RUBRIC,
        "partnerInput": {
            "partner": "arkhai",
            "interface": "git-escrows",
            "receipt": {
                "caseId": case_id,
                "source": "local-fixture",
                "network": "local",
                "runner": "local-node-test",
                "tests-repo": "file://fixtures/bounty-tests",
                "tests-commit": tests_commit,
                "testsCommitAlgo": "0",
                "solution-repo": "file://fixtures/solutions/" + name,
                "solution-commit": solution_commit,
                "escrow-uid": "local-escrow-add",
                "fulfillment-uid": "local-fulfillment-" + name,
                "attester": "local-fixture",
                "recipient": "local-fixture",
                "schemaUid": "local-schema-not-eas",
                "reward": "1000000",
                "token": "parent-must-name-a-test-erc20",
                "oracle": "local-fixture-runner",
                "arbiter": "local-schema-mirror",
                "schema": SCHEMA,
            },
            "testResult": test_result,
        },
    }
    case["freeze"] = freeze_for(case)
    return case


def main() -> None:
    tests = read_tree(ROOT / "fixtures" / "bounty-tests")
    tests_commit = commit_tree(tests)
    out_dir = ROOT / "fixtures" / "cases"
    out_dir.mkdir(parents=True, exist_ok=True)
    index = {"tests-repo": "file://fixtures/bounty-tests", "tests-commit": tests_commit, "cases": []}
    for name in ("pass", "warn", "constrain", "revoke", "escalate"):
        solution = read_tree(ROOT / "fixtures" / "solutions" / name)
        solution_commit = commit_tree(solution)
        case = build_case(name, tests_commit, solution_commit, solution, tests, name != "escalate")
        (out_dir / (name + ".json")).write_text(json.dumps(case, indent=2) + "\n", encoding="utf-8")
        index["cases"].append(
            {
                "file": "fixtures/cases/" + name + ".json",
                "caseId": case["caseId"],
                "solution-commit": solution_commit,
                "evidenceHash": case["freeze"]["evidenceHash"],
            }
        )
        print(name, case["caseId"], "tests-commit", tests_commit[:12], "solution", solution_commit[:12])
    (out_dir / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
