import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")


class SentinelHubConfigurationError(RuntimeError):
    """Raised when the service cannot authenticate to Copernicus Data Space."""


@dataclass(frozen=True)
class Settings:
    copernicus_client_id: str
    copernicus_client_secret: str
    aoi_radius_meters: int = 150
    date_window_days: int = 30
    max_cloud_coverage: float = 0.30

    @classmethod
    def from_environment(cls) -> "Settings":
        client_id = os.getenv("COPERNICUS_CLIENT_ID", "")
        client_secret = os.getenv("COPERNICUS_CLIENT_SECRET", "")
        if not client_id or not client_secret:
            raise SentinelHubConfigurationError(
                "COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET must be set"
            )
        return cls(copernicus_client_id=client_id, copernicus_client_secret=client_secret)
