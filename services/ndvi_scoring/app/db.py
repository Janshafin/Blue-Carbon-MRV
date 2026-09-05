import os
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Float,
    Integer,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, scoped_session

# Project base path
APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[2]
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'blue_carbon.db'}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)

SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
SessionLocal = scoped_session(SessionFactory)
Base = declarative_base()


class SubmissionModel(Base):
    __tablename__ = "submissions"

    id = Column(String(64), primary_key=True, index=True)
    project_name = Column(String(255), default="", nullable=False)
    species = Column(String(100), nullable=False)
    ngo_id = Column(String(100), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    planting_date = Column(String(50), nullable=False)
    wallet_address = Column(String(64), nullable=False, index=True)
    photo_path = Column(String(512), nullable=False)
    description = Column(String(1024), default="", nullable=False)
    exif_data = Column(Text, default="{}", nullable=False)
    status = Column(String(50), default="RECEIVED", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    verification = relationship("VerificationModel", back_populates="submission", uselist=False, cascade="all, delete-orphan")
    blockchain = relationship("BlockchainRecordModel", back_populates="submission", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        exif = {}
        try:
            exif = json.loads(self.exif_data) if self.exif_data else {}
        except Exception:
            exif = {}

        return {
            "id": self.id,
            "project_name": self.project_name or f"Mangrove Planting #{self.id[:8]}",
            "species": self.species,
            "ngo_id": self.ngo_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "planting_date": self.planting_date,
            "wallet_address": self.wallet_address,
            "photo_path": self.photo_path,
            "description": self.description,
            "exif_data": exif,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class VerificationModel(Base):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(String(64), ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    satellite_source = Column(String(100), default="Sentinel-2", nullable=False)
    before_imagery_ref = Column(String(512), nullable=True)
    after_imagery_ref = Column(String(512), nullable=True)
    ndvi_before = Column(Float, nullable=True)
    ndvi_after = Column(Float, nullable=True)
    ndvi_change = Column(Float, nullable=True)
    score = Column(Integer, nullable=True)
    confidence = Column(String(20), nullable=True)
    flags = Column(Text, default="[]", nullable=False)
    eligibility = Column(Boolean, default=False, nullable=False)
    verification_status = Column(String(50), default="PENDING", nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    submission = relationship("SubmissionModel", back_populates="verification")

    def to_dict(self):
        flags_list = []
        try:
            flags_list = json.loads(self.flags) if self.flags else []
        except Exception:
            flags_list = []

        return {
            "submission_id": self.submission_id,
            "satellite_source": self.satellite_source,
            "before_imagery_ref": self.before_imagery_ref,
            "after_imagery_ref": self.after_imagery_ref,
            "ndvi_before": self.ndvi_before,
            "ndvi_after": self.ndvi_after,
            "ndvi_change": self.ndvi_change,
            "score": self.score,
            "confidence": self.confidence,
            "flags": flags_list,
            "eligibility": self.eligibility,
            "verification_status": self.verification_status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class BlockchainRecordModel(Base):
    __tablename__ = "blockchain_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(String(64), ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    wallet_address = Column(String(64), nullable=False)
    network = Column(String(50), default="sepolia", nullable=False)
    contract_address = Column(String(64), default="", nullable=False)
    token_id = Column(String(64), nullable=True)
    credit_amount = Column(String(50), default="100", nullable=False)
    transaction_hash = Column(String(128), nullable=True, index=True)
    blockchain_status = Column(String(50), default="unregistered", nullable=False)
    metadata_uri = Column(String(512), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    submission = relationship("SubmissionModel", back_populates="blockchain")

    def to_dict(self):
        return {
            "submission_id": self.submission_id,
            "wallet_address": self.wallet_address,
            "network": self.network,
            "contract_address": self.contract_address,
            "token_id": self.token_id,
            "credit_amount": self.credit_amount,
            "transaction_hash": self.transaction_hash,
            "blockchain_status": self.blockchain_status,
            "metadata_uri": self.metadata_uri,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
