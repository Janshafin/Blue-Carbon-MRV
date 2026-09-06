import os
from typing import Dict, Any, Optional, Tuple
from web3 import Web3
from web3.exceptions import Web3Exception

DEFAULT_CONTRACT_ADDRESS = "0x815F9122D29471e161D66068Eef9a508EC079442"
DEFAULT_CHAIN_ID = 11155111  # Sepolia

# BlueCarbonCredit minimal ABI for verifier operations
BLUE_CARBON_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "role", "type": "bytes32"},
            {"internalType": "address", "name": "account", "type": "address"},
        ],
        "name": "hasRole",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "submissionId", "type": "bytes32"},
            {"internalType": "string", "name": "metadataURI", "type": "string"},
            {"internalType": "address", "name": "beneficiary", "type": "address"},
            {"internalType": "uint256", "name": "creditAmount", "type": "uint256"},
        ],
        "name": "registerSubmission",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "submissionId", "type": "bytes32"}],
        "name": "releaseCredits",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "submissionId", "type": "bytes32"}],
        "name": "getSubmission",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "submissionId", "type": "bytes32"},
                    {"internalType": "string", "name": "metadataURI", "type": "string"},
                    {"internalType": "address", "name": "beneficiary", "type": "address"},
                    {"internalType": "uint256", "name": "creditAmount", "type": "uint256"},
                    {"internalType": "uint256", "name": "mintedAt", "type": "uint256"},
                    {"internalType": "uint8", "name": "status", "type": "uint8"},
                    {"internalType": "string", "name": "disputeReason", "type": "string"},
                    {"internalType": "address", "name": "disputedBy", "type": "address"},
                ],
                "internalType": "struct BlueCarbonCredit.Submission",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

VERIFIER_ROLE = Web3.keccak(text="VERIFIER_ROLE")
DISPUTER_ROLE = Web3.keccak(text="DISPUTER_ROLE")


class BlockchainConfigError(Exception):
    """Raised when blockchain configuration or credentials are missing."""


class BlockchainExecutionError(Exception):
    """Raised when a blockchain transaction or role check fails."""


def get_web3_instance() -> Tuple[Web3, str]:
    """Returns a configured Web3 instance and RPC URL, or raises BlockchainConfigError."""
    rpc_url = (
        os.getenv("SEPOLIA_RPC_URL")
        or os.getenv("RPC_URL")
        or ""
    ).strip()

    if not rpc_url:
        raise BlockchainConfigError("Sepolia RPC_URL is not configured.")

    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 15}))
    return w3, rpc_url


def get_contract_address() -> str:
    addr = os.getenv("CONTRACT_ADDRESS") or os.getenv("BLUE_CARBON_CREDIT_ADDRESS") or DEFAULT_CONTRACT_ADDRESS
    return Web3.to_checksum_address(addr.strip())


def get_verifier_account(w3: Web3):
    pk = (os.getenv("VERIFIER_PRIVATE_KEY") or os.getenv("PRIVATE_KEY") or "").strip()
    if not pk:
        raise BlockchainConfigError("Blockchain verifier wallet is not configured.")

    if not pk.startswith("0x"):
        pk = "0x" + pk

    try:
        account = w3.eth.account.from_key(pk)
        return account
    except Exception as e:
        raise BlockchainConfigError(f"Invalid verifier private key: {e}") from e


def compute_submission_id_bytes(raw_id: str) -> bytes:
    """Derives 32-byte identifier compatible with scripts/manage-blue-carbon.ts."""
    if raw_id.startswith("0x") and len(raw_id) == 66:
        return bytes.fromhex(raw_id[2:])
    return Web3.keccak(text=raw_id)


def check_verifier_role() -> Dict[str, Any]:
    """
    Checks if the configured verifier wallet has VERIFIER_ROLE on the contract.
    Returns status dictionary.
    """
    try:
        w3, rpc_url = get_web3_instance()
        contract_addr = get_contract_address()
        account = get_verifier_account(w3)
    except BlockchainConfigError as e:
        return {
            "configured": False,
            "has_role": False,
            "error": str(e),
        }

    try:
        contract = w3.eth.contract(address=contract_addr, abi=BLUE_CARBON_ABI)
        has_role = contract.functions.hasRole(VERIFIER_ROLE, account.address).call()
        return {
            "configured": True,
            "rpc_connected": w3.is_connected(),
            "contract_address": contract_addr,
            "verifier_address": account.address,
            "has_role": has_role,
            "error": None if has_role else f"Verifier wallet {account.address} does not have required VERIFIER_ROLE on contract {contract_addr}",
        }
    except Exception as e:
        return {
            "configured": True,
            "has_role": False,
            "error": f"Failed to query contract roles: {e}",
        }


def register_submission_onchain(
    submission_id: str,
    metadata_uri: str,
    beneficiary_address: str,
    credit_amount_tokens: int = 100,
) -> Dict[str, Any]:
    """
    Executes registerSubmission on the Sepolia smart contract.
    Never exposes private key.
    Returns transaction hash and receipt status, or raises informative exceptions.
    """
    w3, rpc_url = get_web3_instance()

    if not w3.is_connected():
        raise BlockchainExecutionError(f"Unable to connect to Sepolia RPC endpoint at {rpc_url[:25]}...")

    contract_addr = get_contract_address()
    account = get_verifier_account(w3)

    # Validate beneficiary address
    if not Web3.is_address(beneficiary_address):
        raise BlockchainExecutionError(f"Invalid beneficiary wallet address: {beneficiary_address}")
    checksum_beneficiary = Web3.to_checksum_address(beneficiary_address)

    contract = w3.eth.contract(address=contract_addr, abi=BLUE_CARBON_ABI)

    # Check verifier role before attempting transaction
    try:
        has_role = contract.functions.hasRole(VERIFIER_ROLE, account.address).call()
        if not has_role:
            raise BlockchainExecutionError(
                f"Verifier wallet {account.address} does not have required VERIFIER_ROLE on contract {contract_addr}. "
                "Admin must grant VERIFIER_ROLE before registrations can be minted."
            )
    except Web3Exception as e:
        raise BlockchainExecutionError(f"Failed to query verifier role: {e}") from e

    sub_id_bytes = compute_submission_id_bytes(submission_id)
    credit_amount_wei = Web3.to_wei(credit_amount_tokens, "ether")

    try:
        nonce = w3.eth.get_transaction_count(account.address, "pending")
        chain_id = w3.eth.chain_id

        # Build transaction
        tx = contract.functions.registerSubmission(
            sub_id_bytes,
            metadata_uri,
            checksum_beneficiary,
            credit_amount_wei,
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "chainId": chain_id,
        })

        # Estimate gas
        try:
            estimated_gas = w3.eth.estimate_gas(tx)
            tx["gas"] = int(estimated_gas * 1.25)
        except Exception:
            tx["gas"] = 350000

        # Sign transaction locally
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=account.key)

        # Broadcast transaction
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = tx_hash.hex()

        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        return {
            "success": receipt.status == 1,
            "transaction_hash": tx_hash_hex,
            "block_number": receipt.blockNumber,
            "contract_address": contract_addr,
            "beneficiary": checksum_beneficiary,
            "credit_amount": str(credit_amount_tokens),
            "status": "provisional" if receipt.status == 1 else "reverted",
        }

    except Exception as e:
        raise BlockchainExecutionError(f"Smart contract transaction failed: {e}") from e
