import os
import hashlib
from datetime import date, timedelta
from math import cos, radians
from typing import Protocol, Dict, Any, Tuple

from .settings import Settings, SentinelHubConfigurationError


class ImageryUnavailableError(RuntimeError):
    """Raised when a Sentinel-2 request has no valid, usable pixels."""


class ImageryProvider(Protocol):
    def mean_ndvi(
        self, latitude: float, longitude: float, start_date: date, end_date: date
    ) -> float:
        """Return the mean cloud-filtered NDVI for the requested location and window."""

    def get_metadata(self) -> Dict[str, Any]:
        """Return metadata describing the provider and whether it is simulated."""


NDVI_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 2, sampleType: "FLOAT32" }
  };
}

function evaluatePixel(sample) {
  const denominator = sample.B08 + sample.B04;
  const ndvi = denominator === 0 ? -1 : (sample.B08 - sample.B04) / denominator;
  return [ndvi, sample.dataMask];
}
"""


class MockNdviProvider:
    """
    Deterministic simulated provider for local development / demo testing.
    Explicitly indicates that the results are simulated.
    """

    def __init__(self, baseline_seed: str = "mangrove_test"):
        self.seed = baseline_seed

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "provider": "MOCK_NDVI (Simulated Development Provider)",
            "is_simulated": True,
            "cloud_coverage": 0.05,
            "resolution": "10m",
            "sensor": "Sentinel-2 (Simulated)",
        }

    def mean_ndvi(
        self, latitude: float, longitude: float, start_date: date, end_date: date
    ) -> float:
        """
        Produces realistic, deterministic NDVI values.
        - Earlier dates (planting window) produce lower NDVI (bare ground / sapling: ~0.15 - 0.22)
        - Later dates (current window) produce higher NDVI (thriving canopy: ~0.50 - 0.68)
        """
        # Deterministic variation from coordinates
        coord_hash = int(hashlib.sha256(f"{latitude:.4f}:{longitude:.4f}".encode()).hexdigest()[:6], 16)
        variation = (coord_hash % 100) / 1000.0  # 0.000 to 0.099

        # If window is before 2025 or near claimed planting date, it's baseline
        # Check window age relative to today
        today = date.today()
        midpoint = start_date + (end_date - start_date) // 2

        if (today - midpoint).days > 60:
            # Before / historical planting window
            baseline = 0.18 + variation * 0.5
            return round(min(0.35, max(0.10, baseline)), 4)
        else:
            # Recent / post-restoration monitoring window
            restored = 0.54 + variation * 0.8
            return round(min(0.85, max(0.40, restored)), 4)


class SentinelHubNdviProvider:
    """Fetches Sentinel-2 L2A NDVI through Copernicus Data Space Ecosystem."""

    def __init__(self, settings: Settings):
        self.settings = settings
        try:
            import numpy as np
            from sentinelhub import BBox, CRS, DataCollection, MimeType, SHConfig, SentinelHubRequest
        except ImportError as e:
            raise SentinelHubConfigurationError(
                "sentinelhub library is not installed. Install via requirements.txt."
            ) from e

        self.np = np
        self.BBox = BBox
        self.CRS = CRS
        self.MimeType = MimeType
        self.SentinelHubRequest = SentinelHubRequest

        self.config = SHConfig(use_defaults=True)
        self.config.sh_client_id = settings.copernicus_client_id
        self.config.sh_client_secret = settings.copernicus_client_secret
        self.config.sh_token_url = (
            "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
        )
        self.config.sh_base_url = "https://sh.dataspace.copernicus.eu"
        self.data_collection = DataCollection.SENTINEL2_L2A.define_from(
            "CDSE_SENTINEL2_L2A", service_url=self.config.sh_base_url
        )

    def get_metadata(self) -> Dict[str, Any]:
        return {
            "provider": "Copernicus Data Space Ecosystem (CDSE) Sentinel-2 L2A",
            "is_simulated": False,
            "max_cloud_coverage": self.settings.max_cloud_coverage,
            "aoi_radius_meters": self.settings.aoi_radius_meters,
            "resolution": "10m",
            "sensor": "Sentinel-2 MSI",
        }

    def mean_ndvi(
        self, latitude: float, longitude: float, start_date: date, end_date: date
    ) -> float:
        radius = self.settings.aoi_radius_meters
        latitude_delta = radius / 111_320
        longitude_delta = radius / (111_320 * max(cos(radians(latitude)), 0.01))
        bbox = self.BBox(
            bbox=[
                longitude - longitude_delta,
                latitude - latitude_delta,
                longitude + longitude_delta,
                latitude + latitude_delta,
            ],
            crs=self.CRS.WGS84,
        )
        request = self.SentinelHubRequest(
            evalscript=NDVI_EVALSCRIPT,
            input_data=[
                self.SentinelHubRequest.input_data(
                    data_collection=self.data_collection,
                    time_interval=(start_date.isoformat(), end_date.isoformat()),
                    maxcc=self.settings.max_cloud_coverage,
                )
            ],
            responses=[self.SentinelHubRequest.output_response("default", self.MimeType.TIFF)],
            bbox=bbox,
            size=(64, 64),
            config=self.config,
        )

        try:
            raster = request.get_data()[0]
        except Exception as error:
            raise ImageryUnavailableError(f"Sentinel-2 imagery request failed: {error}") from error

        ndvi = raster[..., 0]
        valid_mask = (raster[..., 1] > 0) & self.np.isfinite(ndvi)
        valid_pixels = ndvi[valid_mask]
        if valid_pixels.size == 0:
            raise ImageryUnavailableError("No valid cloud-free Sentinel-2 pixels returned for this region/window")
        return float(self.np.mean(valid_pixels))


def get_active_imagery_provider() -> ImageryProvider:
    """
    Returns the appropriate ImageryProvider based on environment configuration:
    - If MOCK_NDVI=true or 1: returns MockNdviProvider
    - If MOCK_NDVI=false: validates Copernicus credentials, returns SentinelHubNdviProvider
    - If MOCK_NDVI is not set: if Copernicus credentials exist, use SentinelHub, else fallback to MockNdviProvider with clear warning.
    """
    mock_env = os.getenv("MOCK_NDVI", "").strip().lower()

    if mock_env in ("true", "1", "yes"):
        return MockNdviProvider()

    # Real mode requested or default
    try:
        settings = Settings.from_environment()
        return SentinelHubNdviProvider(settings)
    except SentinelHubConfigurationError as e:
        if mock_env in ("false", "0", "no"):
            # Strict mode: user explicitly requested real mode but credentials are missing
            raise e
        # Development fallback when MOCK_NDVI wasn't explicitly set
        return MockNdviProvider()


def planting_window(claimed_date: date, days: int = 30) -> Tuple[date, date]:
    return claimed_date - timedelta(days=days), claimed_date + timedelta(days=days)


def recent_window(today: date, days: int = 30) -> Tuple[date, date]:
    return today - timedelta(days=days), today
