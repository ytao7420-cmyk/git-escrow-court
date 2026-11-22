# Git escrow court

One local loop: an Arkhai-shaped git-escrow receipt and the test result from the same case are frozen, then a new GenLayer intelligent contract reads back a judgment with evidence citations.

The UI separates that recorded fixture from public RPC reads. A local run is not an Internet Court hosted case, and it is not a public testnet receipt.

## Run the UI

Clone this repository and run it on your own machine. `http://127.0.0.1:43123` is only that local process. The public read-only demo is https://git-escrow-court.vercel.app . Do not enter the local address as the project website.

```bash
python3 -m pip install -r requirements.txt
python3 scripts/prepare_runner.py
npm install
npm run dev
```

Open http://127.0.0.1:43123.

- `/` recorded fixture. The contract runs in the local direct VM.
- `/public` third-party Base Sepolia CommitObligation attestations, plus a read-only Studionet `get_owner`, `list_cases`, and `get_record` through `genlayer-js` `createClient({ chain: studionet })`. The case submit button stays disabled.
- `/live` public RPC balances and bytecode only. It does not call the court contract and it does not show a fixture judgment.
- `/wallet` the already broadcast Studionet 61999 deploy. The page shows `to`, selector, data bytes, source SHA, value, chain, and the fee cap. The deploy button stays disabled and does not call `eth_sendTransaction`. An existing hash can be looked up. Value was 0 and the fee cap was 0.001 test GEN.
- `/submission` which chain facts exist, and which claims this repository does not make.
- `/repro` a separate Studionet `review_case`. Each tab creates its own `repro-` plus 32 hex character case id and keeps that id while a send is pending or retried. Loading it does not connect a wallet or send. The old deploy button and the old case button stay disabled.

The exact unsigned deploy transaction is `fixtures/public/unsigned-deploy.json`. Its contract source SHA256 stays `4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e`.

Private runtime archives, including `git-escrow-court-runtime-v5.tar.gz`, are not in this repository and are not the reproduction path.

The deployed contract `0x37383a73306B8F31d9158C3419C29EED856cc1Bc` stores case `public-0726369d528e`. A Studionet `get_record` read returned decision `escalate`, mandateStatus `escalated`, violation `missing-test-result`, and reasoningSource `deterministic-rubric`. That source is the contract rubric, not an LLM judgment and not an Internet Court hosted ruling. Deploy hash `0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f`. Case hash `0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7`. Execution success is not the judgment. Do not deploy or submit again.

The case input is a third-party Base Sepolia fulfillment, uid `0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b`, from https://github.com/mlegls/git-escrow-bun-test-fulfillment.git and https://github.com/mlegls/git-escrow-bun-test-demand.git. This repository did not create that escrow. There is no LICENSE file; `package.json` is `private`. A source archive is not a public repository.

## New test-case reproduction

`/repro` is not the finalized case above. It targets the same deployed contract and uses `review_case` only. The case id is generated in the browser tab, not hardcoded. A tab keeps that same id for a pending send and for an explicit retry, and it reads `list_cases` before sending so an id that is already stored is not sent again. Reloading after a hash, or after the wallet request has started, leaves the button closed. Studionet 61999 is a testnet. The transaction value is 0. Before `eth_sendTransaction`, the page multiplies the gas limit by `gasPrice` and refuses the click when that fee is above 0.001 test GEN. A wrong chain is refused. `testResult` is null, so the contract rubric returns `escalate` / `missing-test-result` / `deterministic-rubric`. A missing log is not a passed test and not an LLM judgment. `FINALIZED` is not that judgment; `get_record` is read only after every `execution_result` is `SUCCESS`.

The page does not connect, sign, or send during render. A person has to click, and the wallet has to confirm. `npm run test:node` covers that lifecycle with mocks. Those tests do not broadcast, and a mock hash is not an on-chain acceptance. Do not deploy again, and do not submit `public-0726369d528e` again.

## Public website

The read-only demo is https://git-escrow-court.vercel.app . Do not enter `http://127.0.0.1:43123` as the project website. Portal submission, GLP, and Accepted are not claimed. Projects 41 is separate from Mission 101; Mission 101 still needs its own qualification check.

`POST /api/repro-case` is off unless `REPRO_ENCODE_PUBLIC=1`. Turning that on does not publish a transaction. The handler refuses bodies over 32KiB before it parses them, and it allows at most two encodes at a time inside one process. That counter is not a global rate limit: Vercel Hobby has no platform rate limiting, and a new serverless instance starts from zero. `/api/review` and other local-only routes stay unused by the public pages.

GitHub Pages cannot host this app as it is built. `next.config.ts` sets `output: "standalone"`. Chain reads and the unsigned `review_case` encoding go through Node route handlers (`/api/chain-record`, `/api/tx`, `/api/live`, `/api/repro-case`), and `/` runs the local GenVM direct VM. A static export would remove those handlers. Replacing the live read with a frozen JSON judgment would not be the chain result. A read-only `eth_chainId` from `https://ytao7420-cmyk.github.io` is allowed by the Studionet RPC CORS response, but that does not make this Next server a Pages site.

When someone chooses a Node host they already control, the build is:

```bash
npm ci
npm run build
npm run start
```

`npm start` listens on `0.0.0.0:43123`. Those commands do not publish DNS, do not create a GitHub Pages site, and do not send a transaction. `/public` still reads Studionet through the server.

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
