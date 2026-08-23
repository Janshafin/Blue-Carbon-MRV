import { describe, it } from "node:test";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, keccak256, toHex, parseEther } from "viem";

// =====================================================================
//  Constants
// =====================================================================

const VESTING_DURATION = 600; // 10 minutes (demo)
const VERIFIER_ROLE = keccak256(toHex("VERIFIER_ROLE"));
const DISPUTER_ROLE = keccak256(toHex("DISPUTER_ROLE"));

const SUB_ID_1 = keccak256(toHex("submission-001"));
const SUB_ID_2 = keccak256(toHex("submission-002"));
const METADATA_URI = "ipfs://QmTestMetadataHash";
const CREDIT_AMOUNT = parseEther("100"); // 100 BCC

// =====================================================================
//  Helpers
// =====================================================================

/** Advance block time by `seconds` and mine a block. */
async function increaseTime(seconds: number) {
  const conn = await hre.network.getOrCreate("default");
  await conn.provider.request({ method: "evm_increaseTime", params: [seconds] });
  await conn.provider.request({ method: "evm_mine", params: [] });
}

/** Deploy the contract and set up roles. Returns all test fixtures. */
async function deployFixture() {
  const conn = await hre.network.getOrCreate("default");
  const [deployer, verifier, disputer, beneficiary, stranger] =
    await conn.viem.getWalletClients();

  const contract = await conn.viem.deployContract("BlueCarbonCredit", [
    BigInt(VESTING_DURATION),
  ]);

  // Grant roles
  await contract.write.grantRole([VERIFIER_ROLE, verifier.account.address]);
  await contract.write.grantRole([DISPUTER_ROLE, disputer.account.address]);

  const publicClient = await conn.viem.getPublicClient();

  return { contract, deployer, verifier, disputer, beneficiary, stranger, publicClient };
}

/**
 * Assert a Viem contract call reverts with the expected custom error.
 *
 * Viem rejects `contract.write` before broadcasting a reverting transaction.
 * Catching the rejection inside the test avoids Node's unhandled-rejection
 * handling and keeps the custom-error assertion explicit.
 */
async function expectViemRevert(
  operation: () => Promise<unknown>,
  expectedError: string
) {
  try {
    await operation();
    expect.fail(`Expected transaction to revert with ${expectedError}`);
  } catch (error) {
    // `expect.fail` above deliberately throws an AssertionError; do not let it
    // satisfy this helper if the operation unexpectedly succeeds.
    if (error instanceof Error && error.message.startsWith("Expected transaction")) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    expect(message).to.include(expectedError);
  }
}

// =====================================================================
//  Tests
// =====================================================================

describe("BlueCarbonCredit", function () {
  // -------------------------------------------------------------------
  //  Deployment
  // -------------------------------------------------------------------
  describe("Deployment", function () {
    it("should set the correct token name and symbol", async function () {
      const { contract } = await deployFixture();
      expect(await contract.read.name()).to.equal("Blue Carbon Credit");
      expect(await contract.read.symbol()).to.equal("BCC");
    });

    it("should set the vesting duration", async function () {
      const { contract } = await deployFixture();
      expect(await contract.read.vestingDuration()).to.equal(
        BigInt(VESTING_DURATION)
      );
    });

    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const { contract, deployer } = await deployFixture();
      const DEFAULT_ADMIN =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      expect(
        await contract.read.hasRole([DEFAULT_ADMIN, deployer.account.address])
      ).to.be.true;
    });

    it("should grant VERIFIER_ROLE and DISPUTER_ROLE", async function () {
      const { contract, verifier, disputer } = await deployFixture();
      expect(
        await contract.read.hasRole([VERIFIER_ROLE, verifier.account.address])
      ).to.be.true;
      expect(
        await contract.read.hasRole([DISPUTER_ROLE, disputer.account.address])
      ).to.be.true;
    });
  });

  // -------------------------------------------------------------------
  //  Submission Registration
  // -------------------------------------------------------------------
  describe("Submission Registration", function () {
    it("should allow a verifier to register a submission", async function () {
      const { contract, verifier, beneficiary, publicClient } =
        await deployFixture();

      const hash = await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");

      const sub = await contract.read.getSubmission([SUB_ID_1]);
      expect(sub.submissionId).to.equal(SUB_ID_1);
      expect(getAddress(sub.beneficiary)).to.equal(
        getAddress(beneficiary.account.address)
      );
      expect(sub.creditAmount).to.equal(CREDIT_AMOUNT);
      expect(sub.status).to.equal(1); // Provisional
    });

    it("should revert if non-verifier tries to register", async function () {
      const { contract, stranger, beneficiary } = await deployFixture();

      await expectViemRevert(
        () => contract.write.registerSubmission(
          [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
          { account: stranger.account }
        ),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert on duplicate submission ID", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await expectViemRevert(
        () => contract.write.registerSubmission(
          [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
          { account: verifier.account }
        ),
        "SubmissionAlreadyExists"
      );
    });

    it("should revert on zero credit amount", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await expectViemRevert(
        () => contract.write.registerSubmission(
          [SUB_ID_1, METADATA_URI, beneficiary.account.address, 0n],
          { account: verifier.account }
        ),
        "ZeroCreditAmount"
      );
    });

    it("should revert on zero address beneficiary", async function () {
      const { contract, verifier } = await deployFixture();

      await expectViemRevert(
        () => contract.write.registerSubmission(
          [
            SUB_ID_1,
            METADATA_URI,
            "0x0000000000000000000000000000000000000000",
            CREDIT_AMOUNT,
          ],
          { account: verifier.account }
        ),
        "ZeroAddress"
      );
    });
  });

  // -------------------------------------------------------------------
  //  Provisional Minting
  // -------------------------------------------------------------------
  describe("Provisional Minting", function () {
    it("should mint tokens to the beneficiary on registration", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      const balance = await contract.read.balanceOf([
        beneficiary.account.address,
      ]);
      expect(balance).to.equal(CREDIT_AMOUNT);
    });

    it("should lock the tokens (no free transfer)", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      const locked = await contract.read.lockedBalance([
        beneficiary.account.address,
      ]);
      expect(locked).to.equal(CREDIT_AMOUNT);

      const unlocked = await contract.read.unlockedBalanceOf([
        beneficiary.account.address,
      ]);
      expect(unlocked).to.equal(0n);
    });

    it("should prevent transfer of locked tokens", async function () {
      const { contract, verifier, beneficiary, stranger } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await expectViemRevert(
        () => contract.write.transfer(
          [stranger.account.address, CREDIT_AMOUNT],
          { account: beneficiary.account }
        ),
        "TransferExceedsUnlocked"
      );
    });

    it("should track submission count", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );
      await contract.write.registerSubmission(
        [SUB_ID_2, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      const count = await contract.read.getSubmissionCount();
      expect(count).to.equal(2n);
    });
  });

  // -------------------------------------------------------------------
  //  Vesting & Release
  // -------------------------------------------------------------------
  describe("Vesting & Release", function () {
    it("should revert release before vesting period", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await expectViemRevert(
        () => contract.write.releaseCredits([SUB_ID_1], {
          account: verifier.account,
        }),
        "VestingNotElapsed"
      );
    });

    it("should release credits after vesting period", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await increaseTime(VESTING_DURATION + 1);

      await contract.write.releaseCredits([SUB_ID_1], {
        account: verifier.account,
      });

      const sub = await contract.read.getSubmission([SUB_ID_1]);
      expect(sub.status).to.equal(2); // Released

      const locked = await contract.read.lockedBalance([
        beneficiary.account.address,
      ]);
      expect(locked).to.equal(0n);

      const unlocked = await contract.read.unlockedBalanceOf([
        beneficiary.account.address,
      ]);
      expect(unlocked).to.equal(CREDIT_AMOUNT);
    });

    it("should allow transfer after release", async function () {
      const { contract, verifier, beneficiary, stranger } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await increaseTime(VESTING_DURATION + 1);

      await contract.write.releaseCredits([SUB_ID_1], {
        account: verifier.account,
      });

      await contract.write.transfer(
        [stranger.account.address, CREDIT_AMOUNT],
        { account: beneficiary.account }
      );

      const strangerBalance = await contract.read.balanceOf([
        stranger.account.address,
      ]);
      expect(strangerBalance).to.equal(CREDIT_AMOUNT);
    });

    it("should revert release on non-verifier", async function () {
      const { contract, verifier, beneficiary, stranger } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await increaseTime(VESTING_DURATION + 1);

      await expectViemRevert(
        () => contract.write.releaseCredits([SUB_ID_1], {
          account: stranger.account,
        }),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert release on already-released submission", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await increaseTime(VESTING_DURATION + 1);

      await contract.write.releaseCredits([SUB_ID_1], {
        account: verifier.account,
      });

      await expectViemRevert(
        () => contract.write.releaseCredits([SUB_ID_1], {
          account: verifier.account,
        }),
        "InvalidStatus"
      );
    });
  });

  // -------------------------------------------------------------------
  //  Dispute Flow
  // -------------------------------------------------------------------
  describe("Dispute Flow", function () {
    it("should allow a disputer to flag a provisional submission", async function () {
      const { contract, verifier, disputer, beneficiary } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await contract.write.disputeSubmission(
        [SUB_ID_1, "Suspicious NDVI readings"],
        { account: disputer.account }
      );

      const sub = await contract.read.getSubmission([SUB_ID_1]);
      expect(sub.status).to.equal(3); // Disputed
      expect(sub.disputeReason).to.equal("Suspicious NDVI readings");
      expect(getAddress(sub.disputedBy)).to.equal(
        getAddress(disputer.account.address)
      );
    });

    it("should prevent release while disputed", async function () {
      const { contract, verifier, disputer, beneficiary } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await contract.write.disputeSubmission(
        [SUB_ID_1, "Suspicious data"],
        { account: disputer.account }
      );

      await increaseTime(VESTING_DURATION + 1);

      await expectViemRevert(
        () => contract.write.releaseCredits([SUB_ID_1], {
          account: verifier.account,
        }),
        "InvalidStatus"
      );
    });

    it("should revert if non-disputer tries to flag", async function () {
      const { contract, verifier, beneficiary, stranger } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await expectViemRevert(
        () => contract.write.disputeSubmission([SUB_ID_1, "Fake flag"], {
          account: stranger.account,
        }),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should resolve dispute with approval — resume lifecycle", async function () {
      const { contract, verifier, disputer, beneficiary } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await contract.write.disputeSubmission(
        [SUB_ID_1, "Needs review"],
        { account: disputer.account }
      );

      await contract.write.resolveDispute([SUB_ID_1, true], {
        account: verifier.account,
      });

      const sub = await contract.read.getSubmission([SUB_ID_1]);
      expect(sub.status).to.equal(1); // Provisional again

      await increaseTime(VESTING_DURATION + 1);

      await contract.write.releaseCredits([SUB_ID_1], {
        account: verifier.account,
      });

      const subAfter = await contract.read.getSubmission([SUB_ID_1]);
      expect(subAfter.status).to.equal(2); // Released
    });

    it("should resolve dispute with rejection — burn tokens", async function () {
      const { contract, verifier, disputer, beneficiary } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await contract.write.disputeSubmission(
        [SUB_ID_1, "Fraudulent submission"],
        { account: disputer.account }
      );

      await contract.write.resolveDispute([SUB_ID_1, false], {
        account: verifier.account,
      });

      const sub = await contract.read.getSubmission([SUB_ID_1]);
      expect(sub.status).to.equal(4); // Rejected

      const balance = await contract.read.balanceOf([
        beneficiary.account.address,
      ]);
      expect(balance).to.equal(0n);

      const locked = await contract.read.lockedBalance([
        beneficiary.account.address,
      ]);
      expect(locked).to.equal(0n);
    });

    it("should revert resolveDispute on non-disputed submission", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await expectViemRevert(
        () => contract.write.resolveDispute([SUB_ID_1, true], {
          account: verifier.account,
        }),
        "InvalidStatus"
      );
    });

    it("should revert if non-verifier tries to resolve", async function () {
      const { contract, verifier, disputer, beneficiary } =
        await deployFixture();

      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      await contract.write.disputeSubmission(
        [SUB_ID_1, "Issue found"],
        { account: disputer.account }
      );

      await expectViemRevert(
        () => contract.write.resolveDispute([SUB_ID_1, true], {
          account: disputer.account,
        }),
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  // -------------------------------------------------------------------
  //  Access Control
  // -------------------------------------------------------------------
  describe("Access Control", function () {
    it("should allow admin to grant roles", async function () {
      const { contract, stranger } = await deployFixture();

      await contract.write.grantRole([
        VERIFIER_ROLE,
        stranger.account.address,
      ]);

      expect(
        await contract.read.hasRole([
          VERIFIER_ROLE,
          stranger.account.address,
        ])
      ).to.be.true;
    });

    it("should prevent non-admin from granting roles", async function () {
      const { contract, verifier, stranger } = await deployFixture();

      await expectViemRevert(
        () => contract.write.grantRole(
          [VERIFIER_ROLE, stranger.account.address],
          { account: verifier.account }
        ),
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should allow admin to revoke roles", async function () {
      const { contract, verifier } = await deployFixture();

      await contract.write.revokeRole([
        VERIFIER_ROLE,
        verifier.account.address,
      ]);

      expect(
        await contract.read.hasRole([
          VERIFIER_ROLE,
          verifier.account.address,
        ])
      ).to.be.false;
    });

    it("should block actions after role is revoked", async function () {
      const { contract, verifier, beneficiary } = await deployFixture();

      await contract.write.revokeRole([
        VERIFIER_ROLE,
        verifier.account.address,
      ]);

      await expectViemRevert(
        () => contract.write.registerSubmission(
          [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
          { account: verifier.account }
        ),
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  // -------------------------------------------------------------------
  //  Edge Cases
  // -------------------------------------------------------------------
  describe("Edge Cases", function () {
    it("should handle partial transfer of unlocked + locked balance", async function () {
      const { contract, verifier, beneficiary, stranger } =
        await deployFixture();

      // Register first submission (locked)
      await contract.write.registerSubmission(
        [SUB_ID_1, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      // Fast-forward and release first submission
      await increaseTime(VESTING_DURATION + 1);
      await contract.write.releaseCredits([SUB_ID_1], {
        account: verifier.account,
      });

      // Register second submission (locked)
      await contract.write.registerSubmission(
        [SUB_ID_2, METADATA_URI, beneficiary.account.address, CREDIT_AMOUNT],
        { account: verifier.account }
      );

      // Beneficiary has 200 BCC total: 100 unlocked + 100 locked
      const total = await contract.read.balanceOf([
        beneficiary.account.address,
      ]);
      expect(total).to.equal(CREDIT_AMOUNT * 2n);

      // Can transfer up to 100 (the unlocked portion)
      await contract.write.transfer(
        [stranger.account.address, CREDIT_AMOUNT],
        { account: beneficiary.account }
      );

      // Cannot transfer any more (remaining is locked)
      await expectViemRevert(
        () => contract.write.transfer([stranger.account.address, 1n], {
          account: beneficiary.account,
        }),
        "TransferExceedsUnlocked"
      );
    });

    it("should revert getSubmission on non-existent ID", async function () {
      const { contract } = await deployFixture();

      const fakeId = keccak256(toHex("does-not-exist"));
      await expectViemRevert(
        () => contract.read.getSubmission([fakeId]),
        "SubmissionNotFound"
      );
    });
  });
});
