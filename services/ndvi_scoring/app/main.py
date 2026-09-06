import os
import re
import json
import uuid
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Depends,
    BackgroundTasks,
    status,
)
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import (
    init_db,
    get_db,
    SubmissionModel,
    VerificationModel,
    BlockchainRecordModel,
)
from .storage import save_submission_photo, resolve_photo_path, StorageError
from .imagery import (
    ImageryProvider,
    SentinelHubNdviProvider,
    get_active_imagery_provider,
)
from .models import ScoreSubmissionRequest, ScoreSubmissionResponse
from .scoring import score_submission
from .settings import SentinelHubConfigurationError, Settings
from .pipeline import run_verification_pipeline
from .blockchain import check_verifier_role

# Initialize tables
init_db()

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[2]
EVIDENCE_DIR = PROJECT_ROOT / "storage" / "evidence"


def create_app(provider: Optional[ImageryProvider] = None) -> FastAPI:
    app = FastAPI(
        title="Blue Carbon MRV API & Verification Engine",
        version="1.0.0",
        description="End-to-end Blue Carbon MRV backend with Sentinel-2 satellite analysis, plausibility scoring, and Sepolia blockchain registry.",
    )

    # CORS configuration for Vite frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── Health Endpoint (Phase 2 & 17) ───────────────────────────────────────
    @app.get("/api/health", tags=["System"])
    def health_check(db: Session = Depends(get_db)):
        # Database check
        db_ok = False
        try:
            db.execute(db.query(SubmissionModel).statement)
            db_ok = True
        except Exception:
            db_ok = False

        # Satellite check
        mock_mode = os.getenv("MOCK_NDVI", "").strip().lower() in ("true", "1", "yes")
        copernicus_configured = bool(
            os.getenv("COPERNICUS_CLIENT_ID") and os.getenv("COPERNICUS_CLIENT_SECRET")
        )

        # Blockchain check
        blockchain_status = check_verifier_role()

        return {
            "status": "healthy" if db_ok else "degraded",
            "database": {"connected": db_ok, "engine": "sqlite"},
            "satellite": {
                "mock_mode": mock_mode,
                "copernicus_configured": copernicus_configured,
                "provider": "MockNdviProvider (Simulated)" if mock_mode else (
                    "Copernicus Sentinel-2 CDSE" if copernicus_configured else "Unconfigured (Requires credentials)"
                ),
            },
            "blockchain": {
                "network": "Sepolia Testnet",
                "contract_configured": True,
                "rpc_configured": bool(os.getenv("SEPOLIA_RPC_URL") or os.getenv("RPC_URL")),
                "verifier_configured": blockchain_status.get("configured", False),
                "has_verifier_role": blockchain_status.get("has_role", False),
                "details": blockchain_status,
            },
        }

    # ─── Submission API (Phase 2) ─────────────────────────────────────────────
    @app.post(
        "/api/submissions",
        status_code=status.HTTP_202_ACCEPTED,
        tags=["Submissions"],
    )
    async def create_submission(
        background_tasks: BackgroundTasks,
        photo: UploadFile = File(...),
        latitude: float = Form(...),
        longitude: float = Form(...),
        planting_date: str = Form(...),
        species: str = Form(...),
        ngo_id: str = Form(...),
        wallet_address: str = Form(...),
        project_name: Optional[str] = Form(None),
        description: Optional[str] = Form(None),
        db: Session = Depends(get_db),
    ):
        # 1. Validation
        if not (-90.0 <= latitude <= 90.0):
            raise HTTPException(
                status_code=400, detail="Latitude must be between -90 and 90 degrees."
            )
        if not (-180.0 <= longitude <= 180.0):
            raise HTTPException(
                status_code=400, detail="Longitude must be between -180 and 180 degrees."
            )

        clean_wallet = wallet_address.strip()
        if not re.match(r"^0x[a-fA-F0-9]{40}$", clean_wallet):
            raise HTTPException(
                status_code=400,
                detail="Invalid Ethereum wallet address. Expected 42-character hex address starting with 0x.",
            )

        if not species.strip():
            raise HTTPException(status_code=400, detail="Species name is required.")
        if not ngo_id.strip():
            raise HTTPException(status_code=400, detail="NGO ID is required.")
        if not planting_date.strip():
            raise HTTPException(status_code=400, detail="Planting date is required.")

        # Validate content type
        if photo.content_type not in ("image/jpeg", "image/png", "image/jpg"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image format '{photo.content_type}'. Only JPEG and PNG are accepted.",
            )

        # 2. Generate unique ID & save photo
        submission_id = str(uuid.uuid4())

        try:
            content = await photo.read()
            photo_ref, exif_data = save_submission_photo(
                submission_id=submission_id,
                filename=photo.filename or "photo.jpg",
                content=content,
            )
            # Sync photo to Supabase Storage if configured
            try:
                from .supabase_client import upload_photo_to_supabase_storage
                upload_photo_to_supabase_storage(
                    filename=f"{submission_id}_{photo.filename or 'photo.jpg'}",
                    file_bytes=content,
                    content_type=photo.content_type or "image/jpeg",
                )
            except Exception:
                pass
        except StorageError as se:
            raise HTTPException(status_code=400, detail=str(se)) from se

        # 3. Preserve user-provided GPS if EXIF GPS is missing
        if exif_data.get("gps_latitude") is None:
            exif_data["gps_latitude_fallback"] = latitude
        if exif_data.get("gps_longitude") is None:
            exif_data["gps_longitude_fallback"] = longitude

        # 4. Save to Database
        sub_record = SubmissionModel(
            id=submission_id,
            project_name=project_name or f"Mangrove Planting #{submission_id[:8]}",
            species=species.strip(),
            ngo_id=ngo_id.strip(),
            latitude=latitude,
            longitude=longitude,
            planting_date=planting_date.strip(),
            wallet_address=clean_wallet,
            photo_path=photo_ref,
            description=description or "",
            exif_data=json.dumps(exif_data),
            status="RECEIVED",
        )
        db.add(sub_record)

        ver_record = VerificationModel(
            submission_id=submission_id,
            satellite_source="Sentinel-2",
            verification_status="RECEIVED",
        )
        db.add(ver_record)

        bc_record = BlockchainRecordModel(
            submission_id=submission_id,
            wallet_address=clean_wallet,
            blockchain_status="unregistered",
        )
        db.add(bc_record)

        db.commit()

        # 5. Launch background verification state machine
        background_tasks.add_task(run_verification_pipeline, submission_id)

        return {
            "success": True,
            "submission_id": submission_id,
            "status": "processing",
            "message": "Submission received and queued for MRV verification",
        }

    # ─── Get Submission State ─────────────────────────────────────────────────
    @app.get("/api/submissions/{submission_id}", tags=["Submissions"])
    def get_submission(submission_id: str, db: Session = Depends(get_db)):
        sub = db.query(SubmissionModel).filter(SubmissionModel.id == submission_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail=f"Submission '{submission_id}' not found.")

        result = sub.to_dict()
        if sub.verification:
            result["verification"] = sub.verification.to_dict()
        if sub.blockchain:
            result["blockchain"] = sub.blockchain.to_dict()

        return result

    # ─── Get Verification Details ─────────────────────────────────────────────
    @app.get("/api/submissions/{submission_id}/verification", tags=["Submissions"])
    def get_submission_verification(submission_id: str, db: Session = Depends(get_db)):
        sub = db.query(SubmissionModel).filter(SubmissionModel.id == submission_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail=f"Submission '{submission_id}' not found.")

        ver = sub.verification
        bc = sub.blockchain

        flags = []
        if ver and ver.flags:
            try:
                flags = json.loads(ver.flags)
            except Exception:
                flags = []

        is_mock = os.getenv("MOCK_NDVI", "").strip().lower() in ("true", "1", "yes")

        return {
            "submission_id": sub.id,
            "verification_status": ver.verification_status if ver else sub.status,
            "ndvi_before": ver.ndvi_before if ver else None,
            "ndvi_after": ver.ndvi_after if ver else None,
            "ndvi_change": ver.ndvi_change if ver else None,
            "score": ver.score if ver else None,
            "confidence": ver.confidence if ver else None,
            "flags": flags,
            "satellite_imagery_information": {
                "source": ver.satellite_source if ver else "Sentinel-2",
                "is_simulated": is_mock,
                "resolution": "10m",
                "sensor": "Sentinel-2 MSI",
            },
            "eligibility": ver.eligibility if ver else False,
            "blockchain_status": bc.blockchain_status if bc else "unregistered",
            "transaction_hash": bc.transaction_hash if bc else None,
            "blockchain_error": bc.error_message if bc else None,
            "timestamps": {
                "created_at": sub.created_at.isoformat() if sub.created_at else None,
                "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
                "verified_at": ver.updated_at.isoformat() if ver else None,
            },
        }

    # ─── Live Registry Endpoint (Phase 2 & 12) ────────────────────────────────
    @app.get("/api/registry", tags=["Registry"])
    def get_registry(db: Session = Depends(get_db)):
        """
        Returns all verified and provisionally credited projects for the live registry.
        """
        submissions = (
            db.query(SubmissionModel)
            .join(VerificationModel)
            .filter(
                VerificationModel.verification_status.in_(
                    ["VERIFIED", "CREDITED", "BLOCKCHAIN_PENDING", "PROVISIONAL"]
                )
            )
            .order_by(SubmissionModel.created_at.desc())
            .all()
        )

        projects = []
        for s in submissions:
            v = s.verification
            b = s.blockchain
            projects.append({
                "submission_id": s.id,
                "project_name": s.project_name,
                "species": s.species,
                "ngo_id": s.ngo_id,
                "location": {
                    "latitude": s.latitude,
                    "longitude": s.longitude,
                },
                "planting_date": s.planting_date,
                "verification_score": v.score if v else 0,
                "confidence": v.confidence if v else "low",
                "ndvi_before": v.ndvi_before if v else None,
                "ndvi_after": v.ndvi_after if v else None,
                "ndvi_improvement": v.ndvi_change if v else None,
                "status": s.status,
                "verification_status": v.verification_status if v else s.status,
                "wallet_address": s.wallet_address,
                "blockchain_status": b.blockchain_status if b else "unregistered",
                "transaction_hash": b.transaction_hash if b else None,
                "credit_amount": b.credit_amount if b else "100",
                "photo_url": f"/api/evidence/{s.id}/photo",
                "created_at": s.created_at.isoformat() if s.created_at else None,
            })

        return {
            "success": True,
            "total_count": len(projects),
            "projects": projects,
        }

    # ─── Evidence Endpoint (Phase 2 & 10) ─────────────────────────────────────
    @app.get("/api/evidence/{submission_id}", tags=["Evidence"])
    def get_evidence(submission_id: str, db: Session = Depends(get_db)):
        sub = db.query(SubmissionModel).filter(SubmissionModel.id == submission_id).first()
        if not sub:
            raise HTTPException(status_code=404, detail=f"Submission '{submission_id}' not found.")

        evidence_file = EVIDENCE_DIR / f"{submission_id}.json"
        if evidence_file.exists():
            try:
                return json.loads(evidence_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Synthesize public evidence safely without filesystem paths
        ver = sub.verification
        flags = []
        if ver and ver.flags:
            try:
                flags = json.loads(ver.flags)
            except Exception:
                flags = []

        return {
            "submission_id": sub.id,
            "project": sub.project_name,
            "location": {
                "latitude": sub.latitude,
                "longitude": sub.longitude,
            },
            "planting_date": sub.planting_date,
            "species": sub.species,
            "ngo_id": sub.ngo_id,
            "ndvi_before": ver.ndvi_before if ver else None,
            "ndvi_after": ver.ndvi_after if ver else None,
            "ndvi_change": ver.ndvi_change if ver else None,
            "verification_score": ver.score if ver else None,
            "confidence": ver.confidence if ver else None,
            "flags": flags,
            "verification_status": ver.verification_status if ver else sub.status,
            "photo_reference": f"/api/evidence/{sub.id}/photo",
            "satellite_reference": {
                "source": ver.satellite_source if ver else "Sentinel-2",
            },
            "timestamp": sub.created_at.isoformat() if sub.created_at else None,
        }

    # ─── Secure Photo Retrieval (Phase 4) ─────────────────────────────────────
    @app.get("/api/evidence/{submission_id}/photo", tags=["Evidence"])
    def get_submission_photo(submission_id: str, db: Session = Depends(get_db)):
        sub = db.query(SubmissionModel).filter(SubmissionModel.id == submission_id).first()
        if not sub or not sub.photo_path:
            raise HTTPException(status_code=404, detail="Photo not found for this submission.")

        try:
            full_path = resolve_photo_path(sub.photo_path)
        except StorageError as se:
            raise HTTPException(status_code=404, detail=str(se)) from se

        mime_type = "image/png" if full_path.suffix.lower() == ".png" else "image/jpeg"
        return FileResponse(full_path, media_type=mime_type)

    # ─── Backward Compatibility: POST /score-submission ───────────────────────
    @app.post(
        "/score-submission",
        response_model=ScoreSubmissionResponse,
        summary="Score a planting submission's NDVI and EXIF plausibility (legacy)",
        tags=["Core Engine"],
    )
    def score_endpoint(submission: ScoreSubmissionRequest) -> ScoreSubmissionResponse:
        try:
            active_provider = provider or get_active_imagery_provider()
            return score_submission(submission, active_provider)
        except SentinelHubConfigurationError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    return app


app = create_app()
