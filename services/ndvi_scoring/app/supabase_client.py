"""
Supabase Cloud Adapter for Blue Carbon MRV Registry.
Syncs submissions, verifications, and evidence photos to Supabase when configured.
Falls back safely to local SQLite and filesystem when credentials are omitted.
"""

import os
import logging
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")


def is_supabase_enabled() -> bool:
    """Check if valid Supabase connection credentials are provided."""
    return bool(SUPABASE_URL and SUPABASE_KEY)


def get_supabase_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }


def sync_submission_to_supabase(
    submission_id: str,
    project_name: str,
    planting_date: str,
    species: str,
    ngo_id: str,
    wallet_address: str,
    latitude: float,
    longitude: float,
    accuracy: Optional[float] = None,
    photo_url: Optional[str] = None,
    status: str = "PENDING",
) -> bool:
    """Sync a submission record to the Supabase PostgreSQL database."""
    if not is_supabase_enabled():
        return False

    payload = {
        "id": submission_id,
        "project_name": project_name,
        "planting_date": planting_date,
        "species": species,
        "ngo_id": ngo_id,
        "wallet_address": wallet_address,
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "photo_url": photo_url,
        "status": status,
    }

    try:
        url = f"{SUPABASE_URL}/rest/v1/submissions"
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(url, headers=get_supabase_headers(), json=payload)
            if resp.is_success:
                logger.info(f"Successfully synced submission {submission_id} to Supabase.")
                return True
            else:
                logger.warning(f"Supabase submission sync error: {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        logger.warning(f"Failed to reach Supabase during submission sync: {e}")
        return False


def sync_verification_to_supabase(
    submission_id: str,
    status: str,
    score: Optional[float] = None,
    confidence: Optional[str] = None,
    eligibility: bool = False,
    ndvi_before: Optional[float] = None,
    ndvi_after: Optional[float] = None,
    ndvi_change: Optional[float] = None,
    satellite_source: str = "Sentinel-2 L2A",
    is_simulated: bool = True,
    blockchain_status: str = "unregistered",
    transaction_hash: Optional[str] = None,
    blockchain_error: Optional[str] = None,
) -> bool:
    """Sync verification telemetry and blockchain transaction to Supabase."""
    if not is_supabase_enabled():
        return False

    payload = {
        "submission_id": submission_id,
        "verification_status": status,
        "score": score,
        "confidence": confidence,
        "eligibility": eligibility,
        "ndvi_before": ndvi_before,
        "ndvi_after": ndvi_after,
        "ndvi_change": ndvi_change,
        "satellite_source": satellite_source,
        "is_simulated": is_simulated,
        "blockchain_status": blockchain_status,
        "transaction_hash": transaction_hash,
        "blockchain_error": blockchain_error,
    }

    try:
        url = f"{SUPABASE_URL}/rest/v1/verifications"
        headers = get_supabase_headers()
        # Merge on submission_id
        headers["Prefer"] = "resolution=merge-duplicates"
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.is_success:
                logger.info(f"Successfully synced verification for {submission_id} to Supabase.")
                return True
            else:
                logger.warning(f"Supabase verification sync error: {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        logger.warning(f"Failed to reach Supabase during verification sync: {e}")
        return False


def upload_photo_to_supabase_storage(filename: str, file_bytes: bytes, content_type: str = "image/jpeg") -> Optional[str]:
    """Upload an evidence photo to Supabase Storage bucket 'evidence'."""
    if not is_supabase_enabled():
        return None

    try:
        url = f"{SUPABASE_URL}/storage/v1/object/evidence/{filename}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, headers=headers, content=file_bytes)
            if resp.is_success:
                public_url = f"{SUPABASE_URL}/storage/v1/object/public/evidence/{filename}"
                logger.info(f"Uploaded photo to Supabase Storage: {public_url}")
                return public_url
            else:
                logger.warning(f"Supabase storage upload error: {resp.status_code} - {resp.text}")
                return None
    except Exception as e:
        logger.warning(f"Failed to upload photo to Supabase storage: {e}")
        return None
