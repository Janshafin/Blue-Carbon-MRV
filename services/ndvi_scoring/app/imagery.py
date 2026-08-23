from datetime import date, timedelta
from math import cos, radians
from typing import Protocol

import numpy as np
from sentinelhub import BBox, CRS, DataCollection, MimeType, SHConfig, SentinelHubRequest

from .settings import Settings


class ImageryUnavailableError(RuntimeError):
    """Raised when a Sentinel-2 request has no valid, usable pixels."""


class ImageryProvider(Protocol):
    def mean_ndvi(
        self, latitude: float, longitude: float, start_date: date, end_date: date
    ) -> float:
        """Return the mean cloud-filtered NDVI for the requested location and window."""


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


class SentinelHubNdviProvider:
    """Fetches Sentinel-2 L2A NDVI through Copernicus Data Space Ecosystem."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.config = SHConfig()
        self.config.sh_client_id = settings.copernicus_client_id
        self.config.sh_client_secret = settings.copernicus_client_secret
        self.config.sh_token_url = (
            "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
        )
        self.config.sh_base_url = "https://sh.dataspace.copernicus.eu"

    def mean_ndvi(
        self, latitude: float, longitude: float, start_date: date, end_date: date
    ) -> float:
        radius = self.settings.aoi_radius_meters
        latitude_delta = radius / 111_320
        longitude_delta = radius / (111_320 * max(cos(radians(latitude)), 0.01))
        bbox = BBox(
            bbox=[
                longitude - longitude_delta,
                latitude - latitude_delta,
                longitude + longitude_delta,
                latitude + latitude_delta,
            ],
            crs=CRS.WGS84,
        )
        request = SentinelHubRequest(
            evalscript=NDVI_EVALSCRIPT,
            input_data=[
                SentinelHubRequest.input_data(
                    data_collection=DataCollection.SENTINEL2_L2A,
                    time_interval=(start_date.isoformat(), end_date.isoformat()),
                    maxcc=self.settings.max_cloud_coverage,
                )
            ],
            responses=[SentinelHubRequest.output_response("default", MimeType.TIFF)],
            bbox=bbox,
            size=(64, 64),
            config=self.config,
        )

        try:
            raster = request.get_data()[0]
        except Exception as error:  # Sentinel Hub has several transport exception types.
            raise ImageryUnavailableError("Sentinel-2 imagery request failed") from error

        ndvi = raster[..., 0]
        valid_mask = (raster[..., 1] > 0) & np.isfinite(ndvi)
        valid_pixels = ndvi[valid_mask]
        if valid_pixels.size == 0:
            raise ImageryUnavailableError("No valid Sentinel-2 pixels were returned")
        return float(np.mean(valid_pixels))


def planting_window(claimed_date: date, days: int) -> tuple[date, date]:
    return claimed_date - timedelta(days=days), claimed_date + timedelta(days=days)


def recent_window(today: date, days: int) -> tuple[date, date]:
    return today - timedelta(days=days), today
