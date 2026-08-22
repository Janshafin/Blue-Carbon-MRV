// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BlueCarbonCredit
 * @author Blue Carbon MRV — Core Engine Team
 * @notice ERC-20 token representing blue carbon credits with a staged lifecycle:
 *         Registered → Provisional (non-transferable) → Released (tradeable).
 *         Includes a dispute/challenge mechanism that can pause progression.
 *
 * @dev Transfer restriction: provisional/vesting credits are locked per-address.
 *      The _update() override blocks transfers that would dip into locked balance.
 *      Only the releaseCredits() flow unlocks tokens for free transfer.
 */
contract BlueCarbonCredit is ERC20, AccessControl {
    // =====================================================================
    //  Roles
    // =====================================================================

    /// @notice NCCR-side verifier — can register submissions and release credits.
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    /// @notice Auditor/NGO/citizen — can flag submissions with a dispute.
    bytes32 public constant DISPUTER_ROLE = keccak256("DISPUTER_ROLE");

    // =====================================================================
    //  Enums & Structs
    // =====================================================================

    enum SubmissionStatus {
        Registered,
        Provisional,
        Released,
        Disputed,
        Rejected
    }

    struct Submission {
        bytes32 submissionId;
        string metadataURI;       // IPFS / off-chain link
        address beneficiary;      // receives the credits
        uint256 creditAmount;     // token amount (18 decimals)
        uint256 mintedAt;         // block.timestamp when provisional
        SubmissionStatus status;
        string disputeReason;     // populated when disputed
        address disputedBy;       // who filed the dispute
    }

    // =====================================================================
    //  State
    // =====================================================================

    /// @notice Duration (seconds) a submission must vest before release.
    /// @dev Default is demo-friendly (600 s = 10 min). Production: 6–24 months.
    uint256 public immutable vestingDuration;

    /// @dev submissionId → Submission
    mapping(bytes32 => Submission) private _submissions;

    /// @dev Track all submission IDs for enumeration (admin dashboard).
    bytes32[] private _submissionIds;

    /// @dev Per-address locked (non-transferable) balance.
    mapping(address => uint256) public lockedBalance;

    // =====================================================================
    //  Events
    // =====================================================================

    event SubmissionRegistered(
        bytes32 indexed submissionId,
        address indexed beneficiary,
        uint256 creditAmount,
        string metadataURI
    );

    event CreditProvisional(
        bytes32 indexed submissionId,
        address indexed beneficiary,
        uint256 amount
    );

    event CreditReleased(
        bytes32 indexed submissionId,
        address indexed beneficiary,
        uint256 amount
    );

    event SubmissionDisputed(
        bytes32 indexed submissionId,
        address indexed disputedBy,
        string reason
    );

    event DisputeResolved(
        bytes32 indexed submissionId,
        bool approved,
        address indexed resolvedBy
    );

    // =====================================================================
    //  Errors
    // =====================================================================

    error SubmissionAlreadyExists(bytes32 submissionId);
    error SubmissionNotFound(bytes32 submissionId);
    error InvalidStatus(bytes32 submissionId, SubmissionStatus current, SubmissionStatus expected);
    error VestingNotElapsed(bytes32 submissionId, uint256 releaseTime);
    error ZeroCreditAmount();
    error ZeroAddress();
    error TransferExceedsUnlocked(address from, uint256 requested, uint256 unlocked);

    // =====================================================================
    //  Constructor
    // =====================================================================

    /**
     * @param _vestingDuration Seconds a submission must vest. Default for demo: 600 (10 min).
     */
    constructor(uint256 _vestingDuration) ERC20("Blue Carbon Credit", "BCC") {
        vestingDuration = _vestingDuration;

        // Deployer gets admin — can grant VERIFIER_ROLE and DISPUTER_ROLE.
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // =====================================================================
    //  Core Lifecycle
    // =====================================================================

    /**
     * @notice Register a plantation submission and immediately mint provisional credits.
     * @param submissionId Unique identifier (from backend / IPFS CID hash).
     * @param metadataURI  Off-chain link to plantation data / NDVI report.
     * @param beneficiary  Address that will receive the credits.
     * @param creditAmount Amount of BCC tokens (18 decimals) to mint.
     */
    function registerSubmission(
        bytes32 submissionId,
        string calldata metadataURI,
        address beneficiary,
        uint256 creditAmount
    ) external onlyRole(VERIFIER_ROLE) {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (creditAmount == 0) revert ZeroCreditAmount();
        if (_submissions[submissionId].beneficiary != address(0)) {
            revert SubmissionAlreadyExists(submissionId);
        }

        // Store submission.
        _submissions[submissionId] = Submission({
            submissionId: submissionId,
            metadataURI: metadataURI,
            beneficiary: beneficiary,
            creditAmount: creditAmount,
            mintedAt: block.timestamp,
            status: SubmissionStatus.Provisional,
            disputeReason: "",
            disputedBy: address(0)
        });
        _submissionIds.push(submissionId);

        // Mint provisional (locked) tokens.
        lockedBalance[beneficiary] += creditAmount;
        _mint(beneficiary, creditAmount);

        emit SubmissionRegistered(submissionId, beneficiary, creditAmount, metadataURI);
        emit CreditProvisional(submissionId, beneficiary, creditAmount);
    }

    /**
     * @notice Release credits after the vesting period has elapsed and re-verification.
     * @dev Tokens become fully transferable once released.
     * @param submissionId The submission to release.
     */
    function releaseCredits(bytes32 submissionId) external onlyRole(VERIFIER_ROLE) {
        Submission storage sub = _getSubmission(submissionId);

        if (sub.status != SubmissionStatus.Provisional) {
            revert InvalidStatus(submissionId, sub.status, SubmissionStatus.Provisional);
        }

        uint256 releaseTime = sub.mintedAt + vestingDuration;
        if (block.timestamp < releaseTime) {
            revert VestingNotElapsed(submissionId, releaseTime);
        }

        sub.status = SubmissionStatus.Released;

        // Unlock tokens — they are now freely transferable.
        lockedBalance[sub.beneficiary] -= sub.creditAmount;

        emit CreditReleased(submissionId, sub.beneficiary, sub.creditAmount);
    }

    // =====================================================================
    //  Dispute Mechanism
    // =====================================================================

    /**
     * @notice Flag a submission before it reaches Released state.
     * @param submissionId The submission to dispute.
     * @param reason       Human-readable reason for the dispute.
     */
    function disputeSubmission(
        bytes32 submissionId,
        string calldata reason
    ) external onlyRole(DISPUTER_ROLE) {
        Submission storage sub = _getSubmission(submissionId);

        // Can only dispute Provisional submissions (not yet released, not already disputed).
        if (sub.status != SubmissionStatus.Provisional) {
            revert InvalidStatus(submissionId, sub.status, SubmissionStatus.Provisional);
        }

        sub.status = SubmissionStatus.Disputed;
        sub.disputeReason = reason;
        sub.disputedBy = msg.sender;

        emit SubmissionDisputed(submissionId, msg.sender, reason);
    }

    /**
     * @notice Resolve a dispute: approve (return to Provisional) or reject (burn tokens).
     * @param submissionId The disputed submission.
     * @param approved     true = resume lifecycle; false = reject and burn credits.
     */
    function resolveDispute(
        bytes32 submissionId,
        bool approved
    ) external onlyRole(VERIFIER_ROLE) {
        Submission storage sub = _getSubmission(submissionId);

        if (sub.status != SubmissionStatus.Disputed) {
            revert InvalidStatus(submissionId, sub.status, SubmissionStatus.Disputed);
        }

        if (approved) {
            // Resume — reset to Provisional so it can proceed to release.
            sub.status = SubmissionStatus.Provisional;
        } else {
            // Reject — burn the provisional tokens.
            sub.status = SubmissionStatus.Rejected;
            lockedBalance[sub.beneficiary] -= sub.creditAmount;
            _burn(sub.beneficiary, sub.creditAmount);
        }

        emit DisputeResolved(submissionId, approved, msg.sender);
    }

    // =====================================================================
    //  View Functions
    // =====================================================================

    /**
     * @notice Get full submission details.
     * @param submissionId The submission to query.
     * @return The Submission struct.
     */
    function getSubmission(bytes32 submissionId) external view returns (Submission memory) {
        return _getSubmission(submissionId);
    }

    /**
     * @notice Get the number of registered submissions.
     */
    function getSubmissionCount() external view returns (uint256) {
        return _submissionIds.length;
    }

    /**
     * @notice Get a submission ID by index (for enumeration).
     * @param index The index in the submission array.
     */
    function getSubmissionIdAtIndex(uint256 index) external view returns (bytes32) {
        return _submissionIds[index];
    }

    /**
     * @notice Get the transferable (unlocked) balance for an address.
     * @param account The address to query.
     * @return The amount of BCC that can be freely transferred.
     */
    function unlockedBalanceOf(address account) external view returns (uint256) {
        return balanceOf(account) - lockedBalance[account];
    }

    // =====================================================================
    //  Transfer Restriction Override
    // =====================================================================

    /**
     * @dev Override ERC20._update() to enforce transfer restrictions.
     *      Minting (from == address(0)) and burning (to == address(0)) are unrestricted.
     *      Regular transfers are only allowed up to the sender's unlocked balance.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20) {
        // Allow minting and burning without restriction.
        if (from != address(0) && to != address(0)) {
            uint256 unlocked = balanceOf(from) - lockedBalance[from];
            if (value > unlocked) {
                revert TransferExceedsUnlocked(from, value, unlocked);
            }
        }

        super._update(from, to, value);
    }

    // =====================================================================
    //  ERC-165 — supportsInterface
    // =====================================================================

    /**
     * @dev Required override because both ERC20 and AccessControl define supportsInterface.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // =====================================================================
    //  Internal Helpers
    // =====================================================================

    function _getSubmission(bytes32 submissionId) internal view returns (Submission storage) {
        Submission storage sub = _submissions[submissionId];
        if (sub.beneficiary == address(0)) {
            revert SubmissionNotFound(submissionId);
        }
        return sub;
    }
}
