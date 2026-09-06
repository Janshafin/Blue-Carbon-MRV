import json
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Any, Optional

from .db import SessionLocal, SubmissionModel, VerificationModel, BlockchainRecordModel
from .imagery import get_active_imagery_provider, planting_window, recent_window, ImageryUnavailableError
from .models import ScoreSubmissionRequest, PhotoMetadata
from .scoring import score_submission
from .blockchain import (
    register_submission_onchain,
    BlockchainConfigError,
    BlockchainExecutionError,
)

logger = logging.getLogger("blue_carbon.pipeline")

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[2]
EVIDENCE_DIR = PROJECT_ROOT / "storage" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def generate_and_save_evidence(
    submission: SubmissionModel,
    verification: VerificationModel,
    provider_meta: Dict[str, Any],
) -> str:
    """
    Creates a deterministic evidence record per Phase 10 and saves to storage/evidence/{id}.json.
    Returns the evidence reference URI.
    """
    evidence_payload = {
        "submission_id": submission.id,
        "project": submission.project_name or f"Mangrove Planting #{submission.id[:8]}",
        "location": {
            "latitude": submission.latitude,
            "longitude": submission.longitude,
        },
        "planting_date": submission.planting_date,
        "species": submission.species,
        "ngo_id": submission.ngo_id,
        "beneficiary_wallet": submission.wallet_address,
        "ndvi_before": verification.ndvi_before,
        "ndvi_after": verification.ndvi_after,
        "ndvi_change": verification.ndvi_change,
        "verification_score": verification.score,
        "confidence": verification.confidence,
        "flags": json.loads(verification.flags) if verification.flags else [],
        "verification_status": verification.verification_status,
        "photo_reference": submission.photo_path,
        "satellite_reference": {
            "provider": provider_meta.get("provider", "Sentinel-2"),
            "is_simulated": provider_meta.get("is_simulated", False),
            "sensor": provider_meta.get("sensor", "Sentinel-2 MSI"),
        },
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    evidence_file = EVIDENCE_DIR / f"{submission.id}.json"
    evidence_file.write_text(json.dumps(evidence_payload, indent=2), encoding="utf-8")

    return f"evidence://{submission.id}"


def run_verification_pipeline(submission_id: str):
    """
    Orchestrates the entire verification pipeline for a submission:
    RECEIVED -> PROCESSING -> SATELLITE_ANALYSIS -> SCORING -> VERIFIED/REJECTED -> BLOCKCHAIN_PENDING -> CREDITED/FAILED.
    Thread-safe and persists every step.
    """
    db = SessionLocal()
    try:
        sub = db.query(SubmissionModel).filter(SubmissionModel.id == submission_id).first()
        if not sub:
            logger.error("Submission %s not found in database", submission_id)
            return

        ver = db.query(VerificationModel).filter(VerificationModel.submission_id == submission_id).first()
        if not ver:
            ver = VerificationModel(submission_id=submission_id)
            db.add(ver)

        bc = db.query(BlockchainRecordModel).filter(BlockchainRecordModel.submission_id == submission_id).first()
        if not bc:
            bc = BlockchainRecordModel(submission_id=submission_id, wallet_address=sub.wallet_address)
            db.add(bc)

        # 1. State -> PROCESSING
        sub.status = "PROCESSING"
        ver.verification_status = "PROCESSING"
        db.commit()

        # 2. State -> SATELLITE_ANALYSIS
        sub.status = "SATELLITE_ANALYSIS"
        ver.verification_status = "SATELLITE_ANALYSIS"
        db.commit()

        try:
            provider = get_active_imagery_provider()
            provider_meta = provider.get_metadata()
            ver.satellite_source = provider_meta.get("provider", "Sentinel-2")
        except Exception as e:
            ver.error_message = f"Satellite provider configuration error: {e}"
            ver.verification_status = "FAILED"
            sub.status = "FAILED"
            db.commit()
            return

        # Parse planting date
        try:
            planted_dt = date.fromisoformat(sub.planting_date)
        except Exception:
            try:
                planted_dt = datetime.strptime(sub.planting_date, "%Y-%m-%d").date()
            except Exception:
                planted_dt = date.today()

        # 3. State -> SCORING
        sub.status = "SCORING"
        ver.verification_status = "SCORING"
        db.commit()

        # Parse EXIF metadata
        exif_dict = {}
        try:
            exif_dict = json.loads(sub.exif_data) if sub.exif_data else {}
        except Exception:
            exif_dict = {}

        captured_at_val = None
        if exif_dict.get("captured_at"):
            try:
                captured_at_val = datetime.fromisoformat(exif_dict["captured_at"].rstrip("Z"))
            except Exception:
                pass

        photo_meta = PhotoMetadata(
            gps_latitude=exif_dict.get("gps_latitude"),
            gps_longitude=exif_dict.get("gps_longitude"),
            captured_at=captured_at_val,
        )

        score_req = ScoreSubmissionRequest(
            latitude=sub.latitude,
            longitude=sub.longitude,
            claimed_planting_date=planted_dt,
            photo_metadata=photo_meta,
        )

        score_resp = score_submission(score_req, provider)

        ver.score = score_resp.score
        ver.confidence = score_resp.confidence_band
        ver.flags = json.dumps(score_resp.flags)
        ver.ndvi_before = score_resp.ndvi_before
        ver.ndvi_after = score_resp.ndvi_after
        if score_resp.ndvi_before is not None and score_resp.ndvi_after is not None:
            ver.ndvi_change = round(score_resp.ndvi_after - score_resp.ndvi_before, 4)

        # 4. Eligibility Decision
        # An MRV record is eligible for provisional minting if plausibility score >= 60,
        # satellite telemetry confirms positive vegetation increase, and no fatal flags.
        ndvi_improved = (ver.ndvi_change is not None and ver.ndvi_change > 0)
        fatal_flags = {"temporal_inconsistency"}
        has_fatal_flags = any(f in fatal_flags for f in score_resp.flags)

        is_eligible = (
            score_resp.score >= 60
            and ndvi_improved
            and not has_fatal_flags
        )
        ver.eligibility = is_eligible

        if not is_eligible:
            sub.status = "REJECTED"
            ver.verification_status = "REJECTED"
            ver.error_message = (
                f"Submission does not meet eligibility threshold (Score: {score_resp.score}/100, "
                f"NDVI delta: {ver.ndvi_change}, Flags: {score_resp.flags})."
            )
            db.commit()
            return

        # Verification Approved
        sub.status = "VERIFIED"
        ver.verification_status = "VERIFIED"
        db.commit()

        # 5. Evidence generation
        evidence_uri = generate_and_save_evidence(sub, ver, provider_meta)
        bc.metadata_uri = evidence_uri
        db.commit()

        # 6. Blockchain Registration
        sub.status = "BLOCKCHAIN_PENDING"
        ver.verification_status = "BLOCKCHAIN_PENDING"
        bc.blockchain_status = "pending"
        db.commit()

        try:
            bc_result = register_submission_onchain(
                submission_id=sub.id,
                metadata_uri=evidence_uri,
                beneficiary_address=sub.wallet_address,
                credit_amount_tokens=100,
            )

            if bc_result.get("success"):
                sub.status = "CREDITED"
                ver.verification_status = "CREDITED"
                bc.blockchain_status = "provisional"
                bc.transaction_hash = bc_result.get("transaction_hash")
                bc.contract_address = bc_result.get("contract_address", "")
                bc.error_message = None
            else:
                sub.status = "VERIFIED"
                ver.verification_status = "VERIFIED"
                bc.blockchain_status = "failed"
                bc.error_message = "Blockchain transaction reverted on Sepolia."

        except BlockchainConfigError as bce:
            # Missing credentials per Phase 19: do not crash, clearly report missing config
            logger.info("Blockchain registration deferred for %s: %s", sub.id, bce)
            sub.status = "VERIFIED"
            ver.verification_status = "VERIFIED"
            bc.blockchain_status = "unregistered"
            bc.error_message = str(bce)

        except BlockchainExecutionError as bee:
            logger.warning("Blockchain execution error for %s: %s", sub.id, bee)
            sub.status = "VERIFIED"
            ver.verification_status = "VERIFIED"
        db.commit()

        # Supabase Cloud Sync (if SUPABASE_URL and key are configured)
        try:
            from .supabase_client import sync_submission_to_supabase, sync_verification_to_supabase
            sync_submission_to_supabase(
                submission_id=sub.id,
                project_name=sub.project_name or f"Mangrove Planting #{sub.id[:8]}",
                planting_date=sub.planting_date,
                species=sub.species,
                ngo_id=sub.ngo_id,
                wallet_address=sub.wallet_address,
                latitude=sub.latitude,
                longitude=sub.longitude,
                status=sub.status,
            )
            sync_verification_to_supabase(
                submission_id=sub.id,
                status=ver.verification_status,
                score=ver.score,
                confidence=ver.confidence,
                eligibility=ver.eligibility,
                ndvi_before=ver.ndvi_before,
                ndvi_after=ver.ndvi_after,
                ndvi_change=ver.ndvi_change,
                satellite_source=ver.satellite_source or "Sentinel-2",
                is_simulated=provider_meta.get("is_simulated", True),
                blockchain_status=bc.blockchain_status,
                transaction_hash=bc.transaction_hash,
                blockchain_error=bc.error_message,
            )
        except Exception as se:
            logger.debug("Supabase sync skipped: %s", se)

    except Exception as e:
        logger.exception("Verification pipeline error for %s: %s", submission_id, e)
        try:
            sub = db.query(SubmissionModel).filter(SubmissionModel.id == submission_id).first()
            if sub:
                sub.status = "FAILED"
            ver = db.query(VerificationModel).filter(VerificationModel.submission_id == submission_id).first()
            if ver:
                ver.verification_status = "FAILED"
                ver.error_message = f"Internal verification error: {e}"
            db.commit()
        except Exception:
            pass
    finally:
        db.close()
