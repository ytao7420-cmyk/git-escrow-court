---
name: git-escrow-court
description: Review one Arkhai git-escrow delivery with a GenLayer intelligent contract. Use when a tests-repo, tests-commit, solution, and test log must become one frozen case and a continue, warn, constrain, revoke, or escalate judgment.
---

# Git escrow court

This skill runs a local, reproducible review. It does not open a hosted Internet Court case and it does not ask for a private key.

## Boundaries

- Keep the Arkhai field names `tests-repo`, `tests-commit`, `solution-repo`, `solution-commit`, `escrow-uid`, and `fulfillment-uid`.
- Do not rename the bounty into a release-diff trade.
- Court decisions are only `continue`, `warn`, `constrain`, `revoke`, and `escalate`. Map them to `active`, `warned`, `constrained`, `revoked`, and `escalated`.
- Do not store `TRUE`, `FALSE`, or `UNDETERMINED` as the court decision.
- The receipt and the test result must share one case id. A missing test result escalates. It is not a second demo.
- `api.internetcourt.org` is not called. A local or self-deployed contract is not the hosted court.
- The address `0xc5c132B69f57dAAAb75d9ebA86cab504b272Ccbc` is the Sepolia deployer recorded by Arkhai and the address named in the vendored make-git-escrow skill. On Ethereum Sepolia it has no contract code. Do not describe it as a verified live oracle unless a new read shows code and a git-escrow receipt.
- Studionet is chain 61999. Studio-dev is chain 61997. Do not treat a balance on one as a balance on the other.
- Never request an unlimited token allowance. A test approval, if the parent later asks for one, is the exact reward amount.

## One command path

From the repository root:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/prepare_runner.py
python3 scripts/build_fixtures.py
npm install
npm test
python3 scripts/run_integration.py
npm run dev
```

`npm run dev` serves the UI at http://127.0.0.1:43123.

Recorded local fixtures live under `fixtures/cases/`. The amber page is only that local fixture. The public page reads Base Sepolia receipts and the Studionet contract that was actually deployed.

The deployed contract is `0x37383a73306B8F31d9158C3419C29EED856cc1Bc` on Studionet 61999. Deploy transaction `0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f` is `FINALIZED` with GenVM `execution_result` `SUCCESS`. Case transaction `0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7` wrote `public-0726369d528e`. A later `get_record` returned decision `escalate`, mandate status `escalated`, violation `missing-test-result`. Execution success is not that decision; read `get_record`. The input attestation `0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b` is a third-party Base Sepolia record. This project did not create the escrow, and there is no hosted Internet Court case id. Do not deploy again, and do not submit `public-0726369d528e` again. The contract source hash remains `4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e`.

`/repro` prepares a different case id for each browser tab, shaped `repro-` plus 32 hex characters, with deterministic `review_case` and a null test result. The same tab keeps that id while the send is pending or retried, and it does not send an id that `list_cases` already contains. Studionet is a testnet, the value is 0, and the fee checked before `eth_sendTransaction` is at most 0.001 test GEN. The expected rubric result is `escalate`, not a passed test and not an LLM judgment. Rendering the page does not connect a wallet or send. A later person must click and confirm in the wallet. Offline tests mock that path and must not broadcast. The public read-only demo is https://git-escrow-court.vercel.app . Do not use `127.0.0.1` as the website. Do not claim Portal submission, GLP, or Accepted. `POST /api/repro-case` stays off unless `REPRO_ENCODE_PUBLIC=1`. Hobby has no platform rate limit. The in-process encode cap is not global. GitHub Pages cannot run the Node routes.

To install this skill for an agent that reads a skills directory:

```bash
mkdir -p "$HOME/.agents/skills/git-escrow-court"
cp skill/SKILL.md "$HOME/.agents/skills/git-escrow-court/SKILL.md"
```

## What the contract does

`contracts/git_escrow_court.py` recomputes the sha256 freeze of the mandate, rubric, and the partner evidence. It cites `tests-repo`, `tests-commit`, and the test-log hash in the record it stores. Direct mode tests the leader, including a mocked model that must repeat the rubric decision. Integration tests run the deterministic method on local GLSim.

GenVM writing, lint, direct tests, and integration tests stay on the official GenLayer commands: `genvm-lint check`, `pytest tests/direct`, and `gltest` against GLSim.
