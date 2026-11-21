# Git escrow court

One local loop: an Arkhai-shaped git-escrow receipt and the test result from the same case are frozen, then a new GenLayer intelligent contract reads back a judgment with evidence citations.

The UI separates that recorded fixture from public RPC reads. A local run is not an Internet Court hosted case, and it is not a public testnet receipt.

## Run the UI

```bash
python3 -m pip install -r requirements.txt
python3 scripts/prepare_runner.py
npm install
npm run dev
```

Open [the review desk](http://127.0.0.1:43123).

- `/` recorded fixture. The contract runs in the local direct VM.
- `/public` public Base Sepolia CommitObligation attestations, labeled as third-party records.
- `/live` public RPC reads only. No fixture judgment is shown there.
- `/wallet` Studionet 61999 deploy. The page shows `to`, selector, data bytes, source SHA, value, chain, and the fee cap before any click. It does not send a transaction until the MetaMask button is pressed. Value is 0 and the fee cap is 0.001 test GEN. A payload check or a wallet request that does not return stops waiting and leaves the button usable. No transaction hash means it is not deployed.
- `/submission` what is finished and what is not.

The exact unsigned deploy transaction is `fixtures/public/unsigned-deploy.json`. Its contract source SHA256 stays `4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e`.

Stop the previous process, unpack `git-escrow-court-runtime-v5.tar.gz` (SHA256 `2ddd09e9df45ad02ab476fe45c10bd1169d8fa423aed5877cee1db072c954d7e`) into a new directory, and run `./start.sh`. The deployed contract `0x37383a73306B8F31d9158C3419C29EED856cc1Bc` stores case `public-0726369d528e`. A Studionet `get_record` read returned decision `escalate`, mandateStatus `escalated`, violation `missing-test-result`, and reasoningSource `deterministic-rubric`. That source is the contract rubric, not an LLM judgment and not an Internet Court hosted ruling. Deploy hash `0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f`. Case hash `0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7`. Execution success is not the judgment. Do not deploy or submit again.

The case input is a third-party Base Sepolia fulfillment, uid `0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b`, from https://github.com/mlegls/git-escrow-bun-test-fulfillment.git and https://github.com/mlegls/git-escrow-bun-test-demand.git. This repository did not create that escrow. There is no LICENSE file; `package.json` is `private`. A source archive is not a public repository.

## Reproduce the tests

```bash
python3 scripts/build_fixtures.py
npm run test:node
npm run test:evm
genvm-lint check contracts/git_escrow_court.py
npm run test:direct
python3 scripts/run_integration.py
```

`prepare_runner.py` is required once. GenVM `v0.3.0-rc7` publishes `genvm-runners-all.tar.xz`, while `gltest` still requests `genvm-universal.tar.xz` and gets a 404. The script stores the published archive under the name the tools already use.

The contract pins the runner hash from the Internet Court GenLayer skill:

```text
py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6
```

The installed linter also reports a newer hash in that same archive. This contract keeps the skill pin.

## Networks

Official docs recommend starting on Studionet, chain 61999, RPC `https://studio.genlayer.com/api`. Studio-dev is chain 61997 and is a different consensus deployment. A read-only balance check does not move the Studionet balance onto Studio-dev.

Arkhai's published git-escrow networks are Ethereum Sepolia and Base Sepolia. The Sepolia `CommitObligation` in `arkhai-io/git-commit-trading` `contract/deployments/sepolia.json` is `0x5bf1EE1fEC1bC25d20C4537f74bD0909B195DEBd`. The address `0xc5c132B69f57dAAAb75d9ebA86cab504b272Ccbc` is that file's deployer and the demo oracle named by the vendored skill. A read of Ethereum Sepolia showed no contract code there.

## Install the skill

```bash
mkdir -p "$HOME/.agents/skills/git-escrow-court"
cp skill/SKILL.md "$HOME/.agents/skills/git-escrow-court/SKILL.md"
```

## Demo

`scripts/rerecord-demo.sh` prints the click path for a local recording of 45 seconds or less. Do not add a transaction hash the chain did not return.
