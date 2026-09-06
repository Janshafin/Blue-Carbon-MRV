import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
from PIL import Image, ExifTags

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[2]
STORAGE_DIR = PROJECT_ROOT / "storage"
PHOTOS_DIR = STORAGE_DIR / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class StorageError(Exception):
    """Base exception for storage errors."""


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and shell injection."""
    name = Path(filename).name
    # Keep alphanumeric, dashes, underscores, dots
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", name)
    return clean_name or "photo.jpg"


def _convert_to_degrees(value) -> Optional[float]:
    """Helper function to convert GPS coordinates in EXIF format to degrees."""
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return None


def extract_exif_metadata(file_path: Path) -> Dict[str, Any]:
    """
    Extracts EXIF metadata from an image file:
    - GPS latitude and longitude (decimal degrees)
    - captured_at timestamp (ISO 8601)
    - camera make and model
    """
    metadata: Dict[str, Any] = {
        "gps_latitude": None,
        "gps_longitude": None,
        "captured_at": None,
        "make": None,
        "model": None,
        "raw_exif_found": False,
    }

    try:
        with Image.open(file_path) as img:
            raw_exif = img.getexif()
            if not raw_exif:
                return metadata

            metadata["raw_exif_found"] = True

            # Standard EXIF tags
            for tag_id, val in raw_exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, tag_id)
                if tag_name == "Make" and isinstance(val, (str, bytes)):
                    metadata["make"] = val.decode() if isinstance(val, bytes) else val
                elif tag_name == "Model" and isinstance(val, (str, bytes)):
                    metadata["model"] = val.decode() if isinstance(val, bytes) else val
                elif tag_name == "DateTimeOriginal" or tag_name == "DateTime":
                    # Format: 'YYYY:MM:DD HH:MM:SS'
                    try:
                        dt_str = val.decode() if isinstance(val, bytes) else str(val)
                        dt = datetime.strptime(dt_str.strip(), "%Y:%m:%d %H:%M:%S")
                        metadata["captured_at"] = dt.isoformat() + "Z"
                    except Exception:
                        pass

            # GPS IFD
            gps_ifd = raw_exif.get_ifd(ExifTags.IFD.GPSInfo)
            if gps_ifd:
                gps_tags = {}
                for key, val in gps_ifd.items():
                    tag_name = ExifTags.GPSTAGS.get(key, key)
                    gps_tags[tag_name] = val

                lat = gps_tags.get("GPSLatitude")
                lat_ref = gps_tags.get("GPSLatitudeRef", "N")
                lon = gps_tags.get("GPSLongitude")
                lon_ref = gps_tags.get("GPSLongitudeRef", "E")

                if lat and lon:
                    deg_lat = _convert_to_degrees(lat)
                    deg_lon = _convert_to_degrees(lon)
                    if deg_lat is not None and deg_lon is not None:
                        if lat_ref == "S":
                            deg_lat = -deg_lat
                        if lon_ref == "W":
                            deg_lon = -deg_lon
                        metadata["gps_latitude"] = round(deg_lat, 6)
                        metadata["gps_longitude"] = round(deg_lon, 6)

    except Exception:
        # Graceful handling for non-JPEG or stripped EXIF
        pass

    return metadata


def save_submission_photo(
    submission_id: str,
    filename: str,
    content: bytes,
) -> Tuple[str, Dict[str, Any]]:
    """
    Saves an uploaded photo to storage/photos/{submission_id}/{uuid}_{safe_filename}.
    Returns relative storage path and extracted EXIF dict.
    """
    if len(content) > MAX_FILE_SIZE:
        raise StorageError(f"Image size exceeds maximum limit of {MAX_FILE_SIZE // (1024 * 1024)} MB")

    clean_name = sanitize_filename(filename)
    ext = Path(clean_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageError(f"File extension '{ext}' is not permitted. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    sub_dir = PHOTOS_DIR / submission_id
    sub_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4().hex[:12]}_{clean_name}"
    target_path = sub_dir / unique_filename

    target_path.write_bytes(content)

    # Extract EXIF metadata
    exif_data = extract_exif_metadata(target_path)

    relative_ref = f"photos/{submission_id}/{unique_filename}"
    return relative_ref, exif_data


def resolve_photo_path(relative_ref: str) -> Path:
    """
    Resolves relative photo reference to absolute path with directory traversal protection.
    Raises StorageError if file does not exist or traverses outside storage directory.
    """
    cleaned_ref = relative_ref.strip("/\\")
    full_path = (STORAGE_DIR / cleaned_ref).resolve()

    # Path traversal protection
    try:
        common = os.path.commonpath([str(PHOTOS_DIR.resolve()), str(full_path)])
        if common != str(PHOTOS_DIR.resolve()):
            raise StorageError("Invalid file path: path traversal detected.")
    except Exception as e:
        raise StorageError("Invalid path traversal.") from e

    if not full_path.exists() or not full_path.is_file():
        raise StorageError(f"Photo file not found: {relative_ref}")

    return full_path
