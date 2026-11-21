// SPDX-License-Identifier: MIT
// Local mirror of the Arkhai CommitObligation data words.
// This contract is not the Sepolia deployment and it holds no tokens.
pragma solidity ^0.8.26;

contract CommitSchemaMirror {
    function encodeDemand(
        string calldata testsCommit,
        uint8 testsCommitAlgo,
        string[] calldata testsRepos
    ) external pure returns (bytes memory) {
        return abi.encode(testsCommit, testsCommitAlgo, testsRepos);
    }

    function decodeDemand(
        bytes calldata data
    )
        external
        pure
        returns (string memory testsCommit, uint8 testsCommitAlgo, string[] memory testsRepos)
    {
        return abi.decode(data, (string, uint8, string[]));
    }
}
