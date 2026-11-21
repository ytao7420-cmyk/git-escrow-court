import pass from "../../fixtures/cases/pass.json";

export const PARENT_ACCOUNT = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";

export const studionetPreview = {
  action: "deploy GitEscrowCourt, then review_case",
  network: "Studionet",
  chainId: 61999,
  chainIdHex: "0xf22f",
  rpc: "https://studio.genlayer.com/api",
  explorer: "https://explorer-studio.genlayer.com",
  currency: "GEN",
  from: PARENT_ACCOUNT,
  to: "GenLayer consensus deploy path in Studio or the genlayer CLI. This page does not invent calldata.",
  value: "0",
  valueWei: "0",
  observedGasPriceWei: "0",
  feeAuthorization: "0 to 0.001 test GEN",
  contract: "contracts/git_escrow_court.py",
  runner: "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6",
  constructorArguments: [],
  firstWrite: {
    method: "review_case",
    argument: "the JSON body of fixtures/cases/pass.json",
    caseId: pass.caseId,
    evidenceHash: pass.freeze.evidenceHash,
  },
  readsAfter: ["get_record(caseId)", "list_cases()"],
  proofBeforeClaimingDeployment: "a transaction hash of 0x plus 64 hex characters, then a successful execution result",
  notDone: "This cloud run did not sign, did not deploy, and does not have a transaction hash.",
};

export const studioDevWarning = {
  network: "Studio-dev",
  chainId: 61997,
  chainIdHex: "0xf22d",
  rpc: "https://studio-dev.genlayer.com/api",
  note: "Different chain and consensus deployment. Do not point the studionet preset at this RPC. A balance read on this chain is not the Studionet balance.",
};

export const arkhaiApprovalPreview = {
  network: "Ethereum Sepolia",
  chainId: 11155111,
  status: "not prepared for signature",
  value: "0",
  token: "parent must name a Sepolia test ERC-20",
  spender: "the escrow contract the parent selects from the official deployment",
  amount: "1000000 base units, equal to the fixture reward",
  forbidden: "type(uint256).max and any unlimited allowance",
  commitObligation: "0x5bf1EE1fEC1bC25d20C4537f74bD0909B195DEBd",
  note: "No approval transaction is built until the parent names the test token and confirms this exact amount.",
};
