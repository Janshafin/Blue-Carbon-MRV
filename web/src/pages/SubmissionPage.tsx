import "./SubmissionPage.css";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { createSubmission as createSupabaseSubmission } from "../services/apiService";
import type { LocationData } from "../types/submission";

// ─── Constants ────────────────────────────────────────────────────────────────

const MANGROVE_SPECIES = [
  "Avicennia marina",
  "Rhizophora mucronata",
  "Avicennia officinalis",
  "Sonneratia alba",
  "Bruguiera gymnorhiza",
  "Other",
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const submissionSchema = z
  .object({
    plantingDate: z.string().min(1, "Please select the planting date"),
    species: z.enum(MANGROVE_SPECIES as unknown as [string, ...string[]], {
      invalid_type_error: "Please select a mangrove species",
      required_error: "Please select a mangrove species"
    }),
    customSpecies: z.string().optional(),
    ngoId: z
      .string()
      .min(2, "Please enter your NGO ID")
      .max(50, "NGO ID is too long"),
  })
  .refine(
    (data) => {
      if (data.species === "Other") {
        return data.customSpecies && data.customSpecies.trim().length > 0;
      }
      return true;
    },
    { message: "Please enter the species name", path: ["customSpecies"] }
  )
  .refine(
    (data) => {
      if (!data.plantingDate) return true;
      const selected = new Date(data.plantingDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return selected <= today;
    },
    { message: "Planting date cannot be in the future", path: ["plantingDate"] }
  );

type FormValues = z.infer<typeof submissionSchema>;

// ─── Submission States ────────────────────────────────────────────────────────

type PageState = "form" | "submitting" | "success" | "error";

interface SuccessData {
  submissionId: string;
  date: string;
  species: string;
  latitude: number;
  longitude: number;
  ngoId: string;
}

// ─── Location hook (self-contained, no auto-request) ──────────────────────────

type LocationStatus = "idle" | "requesting" | "success" | "denied" | "unavailable" | "timeout";

function useManualLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus("success");
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            setStatus("denied");
            setError("Location permission was denied.");
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            setError("Unable to determine your location.");
            break;
          case GeolocationPositionError.TIMEOUT:
            setStatus("timeout");
            setError("Location request timed out.");
            break;
          default:
            setStatus("unavailable");
            setError("An unknown error occurred.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }, []);

  return { location, status, error, requestLocation };
}

// ─── Helper: format date ──────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the evidence photo."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to encode the evidence photo."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 1 8-1 3.5-3.5 5.5-6 6.5" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <line x1="8" y1="6" x2="8.01" y2="6" />
      <line x1="16" y1="6" x2="16.01" y2="6" />
      <line x1="12" y1="6" x2="12.01" y2="6" />
      <line x1="8" y1="10" x2="8.01" y2="10" />
      <line x1="16" y1="10" x2="16.01" y2="10" />
      <line x1="12" y1="10" x2="12.01" y2="10" />
      <line x1="8" y1="14" x2="8.01" y2="14" />
      <line x1="16" y1="14" x2="16.01" y2="14" />
      <line x1="12" y1="14" x2="12.01" y2="14" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconCrosshair() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconXClose() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Photo Uploader ───────────────────────────────────────────────────────────

interface PhotoUploaderProps {
  photo: File | null;
  preview: string | null;
  error: string;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
}

function PhotoUploader({ photo, preview, error, onPhotoSelect, onPhotoRemove }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");

  const validateAndSelect = useCallback(
    (file: File) => {
      setFileError("");
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setFileError("Only JPG and PNG files are accepted.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError("File size exceeds 10 MB limit.");
        return;
      }
      onPhotoSelect(file);
    },
    [onPhotoSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const displayError = error || fileError;

  return (
    <div className="sp-form-group">
      <div className="sp-form-group__header">
        <span className="sp-form-group__icon"><IconCamera /></span>
        <div>
          <h3 className="sp-form-group__title">Planting Site Photo</h3>
          <p className="sp-form-group__desc">Upload a clear photo showing the planted area or mangrove saplings.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        id="photo-upload-input"
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Upload planting site photo"
      />
      {!preview ? (
        <label
          htmlFor="photo-upload-input"
          className={`sp-dropzone ${isDragging ? "sp-dropzone--active" : ""} ${displayError ? "sp-dropzone--error" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="sp-dropzone__icon"><IconUpload /></div>
          <p className="sp-dropzone__primary">Upload planting site photo</p>
          <p className="sp-dropzone__secondary">Drag & drop or browse</p>
          <p className="sp-dropzone__meta">JPG or PNG · Max 10 MB</p>
        </label>
      ) : (
        <div className="sp-photo-preview">
          <img src={preview} alt="Planting site preview" className="sp-photo-preview__img" />
          <div className="sp-photo-preview__overlay">
            <div className="sp-photo-preview__info">
              <span className="sp-photo-preview__name">{photo?.name}</span>
              <span className="sp-photo-preview__size">
                {photo ? `${(photo.size / 1024).toFixed(0)} KB` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={onPhotoRemove}
              className="sp-photo-preview__remove"
              aria-label="Remove photo"
            >
              <IconX /> Remove
            </button>
          </div>
        </div>
      )}
      {displayError && (
        <p className="sp-field-error" role="alert">
          <IconAlertCircle /> {displayError}
        </p>
      )}
    </div>
  );
}

// ─── Location Capture ─────────────────────────────────────────────────────────

interface LocationCaptureBlockProps {
  location: LocationData | null;
  status: LocationStatus;
  geoError: string | null;
  validationError: string;
  onRequestLocation: () => void;
}

function LocationCaptureBlock({ location, status, geoError, validationError, onRequestLocation }: LocationCaptureBlockProps) {
  return (
    <div className="sp-form-group">
      <div className="sp-form-group__header">
        <span className="sp-form-group__icon"><IconMapPin /></span>
        <div>
          <h3 className="sp-form-group__title">Planting Location</h3>
          <p className="sp-form-group__desc">Capture the location where the restoration activity took place.</p>
        </div>
      </div>

      {status === "idle" && (
        <button
          type="button"
          onClick={onRequestLocation}
          className={`sp-location-btn ${validationError ? "sp-location-btn--error" : ""}`}
          id="get-location-btn"
        >
          <IconCrosshair />
          Use my current location
        </button>
      )}

      {status === "requesting" && (
        <div className="sp-location-loading">
          <div className="sp-spinner" />
          <span>Locating planting site…</span>
        </div>
      )}

      {status === "success" && location && (
        <div className="sp-location-success">
          <div className="sp-location-success__coords">
            <div className="sp-coord">
              <span className="sp-coord__label">LATITUDE</span>
              <span className="sp-coord__value">{location.latitude.toFixed(4)}°</span>
            </div>
            <div className="sp-coord">
              <span className="sp-coord__label">LONGITUDE</span>
              <span className="sp-coord__value">{location.longitude.toFixed(4)}°</span>
            </div>
          </div>
          <div className="sp-location-success__footer">
            <span className="sp-location-captured">
              <IconCheck /> Location captured
            </span>
            {location.accuracy && (
              <span className="sp-location-accuracy">±{Math.round(location.accuracy)} m</span>
            )}
            <button
              type="button"
              onClick={onRequestLocation}
              className="sp-location-refresh"
              aria-label="Refresh GPS location"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {(status === "denied" || status === "unavailable" || status === "timeout") && (
        <div className="sp-location-error">
          <p className="sp-location-error__msg">{geoError}</p>
          {status === "denied" && (
            <p className="sp-location-error__hint">
              Enable location access in your browser settings to continue.
            </p>
          )}
          <button type="button" onClick={onRequestLocation} className="sp-location-error__retry">
            Try again
          </button>
        </div>
      )}

      {validationError && !location && (
        <p className="sp-field-error" role="alert">
          <IconAlertCircle /> {validationError}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubmissionPage() {
  const isOnline = useOnlineStatus();

  // Photo state
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  // Location state (manual trigger — NOT auto-requesting)
  const { location: geoLocation, status: geoStatus, error: geoError, requestLocation } = useManualLocation();

  // Page state
  const [pageState, setPageState] = useState<PageState>("form");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Location validation
  const [locationError, setLocationError] = useState("");

  // Form
  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      plantingDate: "",
      species: undefined,
      customSpecies: "",
      ngoId: "",
    },
  });

  const watchedValues = watch();
  const isOther = watchedValues.species === "Other";

  // Photo handlers
  const handlePhotoSelect = useCallback((file: File) => {
    setPhoto(file);
    setPhotoError("");
    const url = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const handlePhotoRemove = useCallback(() => {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  }, [photoPreview]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Summary readiness check
  const summaryReady = useMemo(() => {
    return !!(
      photo &&
      geoLocation &&
      watchedValues.plantingDate &&
      watchedValues.species &&
      (watchedValues.species !== "Other" || watchedValues.customSpecies?.trim()) &&
      watchedValues.ngoId?.trim()
    );
  }, [photo, geoLocation, watchedValues]);

  // Submit handler
  const onSubmit = async (values: FormValues) => {
    // Validate photo
    if (!photo) {
      setPhotoError("Please upload a planting site photo.");
      return;
    }

    // Validate location
    if (!geoLocation) {
      setLocationError("Please capture your planting location.");
      return;
    }

    setLocationError("");
    const species =
      values.species === "Other"
        ? (values.customSpecies?.trim() ?? "Other")
        : values.species;

    setPageState("submitting");
    setSubmitError("");

    try {
      const photoBase64 = await fileToDataUrl(photo);
      const result = await createSupabaseSubmission({
        projectName: `${species} Restoration — ${values.ngoId.trim()}`,
        species,
        ngoId: values.ngoId.trim(),
        latitude: geoLocation.latitude,
        longitude: geoLocation.longitude,
        accuracy: geoLocation.accuracy,
        plantedDate: values.plantingDate,
        photoBase64,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "The verification backend did not persist the submission.");
      }

      setSuccessData({
        submissionId: result.data.id,
        date: values.plantingDate,
        species,
        latitude: geoLocation.latitude,
        longitude: geoLocation.longitude,
        ngoId: values.ngoId.trim(),
      });
      setPageState("success");
    } catch (err) {
      console.error("Submission error:", err);
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setSubmitError(isOnline ? message : "No connection to the verification server. The submission was not saved.");
      setPageState("error");
    }
  };

  const handleReset = () => {
    reset();
    setPhoto(null);
    setPhotoError("");
    setLocationError("");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPageState("form");
    setSuccessData(null);
    setSubmitError("");
  };

  const handleRetry = () => {
    setPageState("form");
    setSubmitError("");
  };

  // ─── Navbar ─────────────────────────────────────────────────────────────────

  const Navbar = (
    <header className="sp-nav" role="banner">
      <div className="sp-nav__inner">
        <a href="/" className="sp-nav__logo">
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M16 7c0 0-5 5-5 9s2.5 7 5 9c2.5-2 5-5 5-9s-5-9-5-9z" fill="#38bdf8" opacity="0.35" />
            <path d="M11 19c2.5-1.5 4-4 5-7" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M21 19c-2.5-1.5-4-4-5-7" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="sp-nav__brand">Blue Carbon MRV</span>
        </a>
        <div className="sp-nav__ngo">
          <div className="sp-nav__avatar">N</div>
          <div className="sp-nav__ngo-info">
            <span className="sp-nav__ngo-id">NGO-IND-2048</span>
            <span className="sp-nav__verified">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verified NGO
            </span>
          </div>
        </div>
        <button
          className="sp-nav__mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <IconXClose /> : <IconMenu />}
        </button>
      </div>
      {mobileMenuOpen && (
        <div className="sp-nav__mobile-menu">
          <div className="sp-nav__mobile-ngo">
            <span className="sp-nav__ngo-id">NGO-IND-2048</span>
            <span className="sp-nav__verified">Verified NGO</span>
          </div>
        </div>
      )}
    </header>
  );

  // ─── Hero ───────────────────────────────────────────────────────────────────

  const Hero = (
    <section className="sp-hero">
      <span className="sp-hero__tag">FIELD RECORD · MANGROVE RESTORATION</span>
      <h1 className="sp-hero__title">Submit <span>Planting</span> Proof</h1>
      <p className="sp-hero__subtitle">
        Record your restoration activity with verified GPS location, planting details and photographic evidence for blockchain verification.
      </p>
    </section>
  );

  // ─── Submission Summary (right panel) ───────────────────────────────────────

  const resolvedSpecies = watchedValues.species === "Other"
    ? (watchedValues.customSpecies?.trim() || null)
    : (watchedValues.species || null);

  const SummaryPanel = (
    <aside className="sp-summary" aria-label="Submission summary">
      <h2 className="sp-summary__title">Submission Summary</h2>
      <div className="sp-summary__items">
        <div className="sp-summary__item">
          <span className="sp-summary__item-label">Photo</span>
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="sp-summary__thumb" />
          ) : (
            <span className="sp-summary__placeholder">Not provided</span>
          )}
        </div>
        <div className="sp-summary__divider" />
        <div className="sp-summary__item">
          <span className="sp-summary__item-label">Location</span>
          {geoLocation ? (
            <div>
              <span className="sp-summary__item-value">
                {geoLocation.latitude.toFixed(4)}, {geoLocation.longitude.toFixed(4)}
              </span>
              <span className="sp-summary__item-tag sp-summary__item-tag--success">Location captured</span>
            </div>
          ) : (
            <span className="sp-summary__placeholder">Not provided</span>
          )}
        </div>
        <div className="sp-summary__divider" />
        <div className="sp-summary__item">
          <span className="sp-summary__item-label">Date</span>
          <span className="sp-summary__item-value">
            {watchedValues.plantingDate ? formatDisplayDate(watchedValues.plantingDate) : <span className="sp-summary__placeholder">Not provided</span>}
          </span>
        </div>
        <div className="sp-summary__divider" />
        <div className="sp-summary__item">
          <span className="sp-summary__item-label">Species</span>
          <span className="sp-summary__item-value">
            {resolvedSpecies || <span className="sp-summary__placeholder">Not provided</span>}
          </span>
        </div>
        <div className="sp-summary__divider" />
        <div className="sp-summary__item">
          <span className="sp-summary__item-label">NGO</span>
          <span className="sp-summary__item-value">
            {watchedValues.ngoId?.trim() || <span className="sp-summary__placeholder">Not provided</span>}
          </span>
        </div>
      </div>
      <div className="sp-summary__footer">
        {summaryReady ? (
          <div className="sp-summary__ready">
            <IconCheck /> Ready for verification
          </div>
        ) : (
          <div className="sp-summary__pending">
            Complete the required fields to continue
          </div>
        )}
      </div>
    </aside>
  );

  // ─── Verification Notice ────────────────────────────────────────────────────

  const VerificationNotice = (
    <div className="sp-trust">
      <div className="sp-trust__icon"><IconShield /></div>
      <div>
        <h3 className="sp-trust__title">Your submission will be reviewed</h3>
        <p className="sp-trust__text">
          Your photo, planting location and activity details are securely submitted to the restoration verification system. The record will enter the review queue for validation.
        </p>
      </div>
    </div>
  );

  // ─── Success State ──────────────────────────────────────────────────────────

  if (pageState === "success" && successData) {
    return (
      <div className="sp-page">
      <div className="sp-global-bg" aria-hidden="true" />
        {Navbar}
        <main className="sp-success-page">
          <div className="sp-success-card">
            <div className="sp-success-check">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#52e3c2" strokeWidth="2" fill="#52e3c2" fillOpacity="0.1" />
                <polyline points="14 25 21 32 34 18" stroke="#52e3c2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1 className="sp-success-card__title">Planting record submitted</h1>
            <p className="sp-success-card__subtitle">
              Your restoration proof has been successfully submitted for review.
            </p>
            <div className="sp-success-details">
              <div className="sp-success-detail">
                <span className="sp-success-detail__label">SUBMISSION ID</span>
                <span className="sp-success-detail__value">{successData.submissionId.slice(0, 18).toUpperCase()}</span>
              </div>
              <div className="sp-success-detail">
                <span className="sp-success-detail__label">STATUS</span>
                <span className="sp-success-detail__value sp-success-detail__value--pending">Pending Review</span>
              </div>
              <div className="sp-success-detail">
                <span className="sp-success-detail__label">LOCATION</span>
                <span className="sp-success-detail__value">
                  {successData.latitude.toFixed(4)}, {successData.longitude.toFixed(4)}
                </span>
              </div>
              <div className="sp-success-detail">
                <span className="sp-success-detail__label">DATE</span>
                <span className="sp-success-detail__value">{formatDisplayDate(successData.date)}</span>
              </div>
              <div className="sp-success-detail">
                <span className="sp-success-detail__label">SPECIES</span>
                <span className="sp-success-detail__value">{successData.species}</span>
              </div>
              <div className="sp-success-detail">
                <span className="sp-success-detail__label">NGO ID</span>
                <span className="sp-success-detail__value">{successData.ngoId}</span>
              </div>
            </div>
            <div className="sp-success-actions">
              <button type="button" onClick={handleReset} className="sp-btn sp-btn--primary">Submit Another Record</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────────

  if (pageState === "error") {
    return (
      <div className="sp-page">
        <div className="sp-global-bg" aria-hidden="true" />
        {Navbar}
        <main className="sp-success-page">
          <div className="sp-success-card sp-error-card">
            <div className="sp-error-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="#c0392b" strokeWidth="2" fill="#c0392b" fillOpacity="0.08" />
                <line x1="16" y1="16" x2="32" y2="32" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" />
                <line x1="32" y1="16" x2="16" y2="32" stroke="#c0392b" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="sp-success-card__title">Submission failed</h1>
            <p className="sp-success-card__subtitle">{submitError}</p>
            <div className="sp-success-actions">
              <button type="button" onClick={handleRetry} className="sp-btn sp-btn--primary">Try Again</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Submitting State ───────────────────────────────────────────────────────

  if (pageState === "submitting") {
    return (
      <div className="sp-page">
        <div className="sp-global-bg" aria-hidden="true" />
        {Navbar}
        <main className="sp-success-page">
          <div className="sp-success-card">
            <div className="sp-submitting-spinner">
              <div className="sp-spinner sp-spinner--lg" />
            </div>
            <h1 className="sp-success-card__title">Submitting…</h1>
            <p className="sp-success-card__subtitle">Recording your planting proof for verification.</p>
          </div>
        </main>
      </div>
    );
  }

  // ─── Form Page ──────────────────────────────────────────────────────────────

  return (
    <main className="sp-main" id="submit">
      <div className="sp-layout">
        {/* Left: Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="sp-form"
            noValidate
            id="submission-form"
          >
            {/* 1. Photo Upload */}
            <PhotoUploader
              photo={photo}
              preview={photoPreview}
              error={photoError}
              onPhotoSelect={handlePhotoSelect}
              onPhotoRemove={handlePhotoRemove}
            />

            {/* 2. GPS Location */}
            <LocationCaptureBlock
              location={geoLocation}
              status={geoStatus}
              geoError={geoError}
              validationError={locationError}
              onRequestLocation={requestLocation}
            />

            {/* 3. Planting Date */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconCalendar /></span>
                <div>
                  <h3 className="sp-form-group__title">Planting Date</h3>
                  <p className="sp-form-group__desc">When did this restoration activity take place?</p>
                </div>
              </div>
              <input
                id="planting-date"
                type="date"
                className={`sp-input ${errors.plantingDate ? "sp-input--error" : ""}`}
                max={new Date().toISOString().split("T")[0]}
                {...register("plantingDate")}
                aria-describedby="planting-date-error"
              />
              {watchedValues.plantingDate && (
                <p className="sp-date-display">{formatDisplayDate(watchedValues.plantingDate)}</p>
              )}
              {errors.plantingDate && (
                <p className="sp-field-error" role="alert" id="planting-date-error">
                  <IconAlertCircle /> {errors.plantingDate.message}
                </p>
              )}
            </div>

            {/* 4. Species */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconLeaf /></span>
                <div>
                  <h3 className="sp-form-group__title">Mangrove Species</h3>
                  <p className="sp-form-group__desc">Select the species planted at this site.</p>
                </div>
              </div>
              <Controller
                name="species"
                control={control}
                render={({ field }) => (
                  <div className="sp-select-wrapper">
                    <select
                      id="species-select"
                      className={`sp-input sp-select ${errors.species ? "sp-input--error" : ""}`}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      aria-describedby="species-error"
                    >
                      <option value="" disabled>Select species…</option>
                      {MANGROVE_SPECIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <span className="sp-select-chevron"><IconChevronDown /></span>
                  </div>
                )}
              />
              {errors.species && (
                <p className="sp-field-error" role="alert" id="species-error">
                  <IconAlertCircle /> {errors.species.message}
                </p>
              )}
              {isOther && (
                <input
                  id="custom-species"
                  type="text"
                  placeholder="Enter species name"
                  className={`sp-input sp-input--mt ${errors.customSpecies ? "sp-input--error" : ""}`}
                  {...register("customSpecies")}
                  aria-describedby="custom-species-error"
                />
              )}
              {errors.customSpecies && (
                <p className="sp-field-error" role="alert" id="custom-species-error">
                  <IconAlertCircle /> {errors.customSpecies.message}
                </p>
              )}
            </div>

            {/* 5. NGO ID */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconBuilding /></span>
                <div>
                  <h3 className="sp-form-group__title">NGO Identification</h3>
                  <p className="sp-form-group__desc">Enter the registered NGO ID associated with this planting activity.</p>
                </div>
              </div>
              <input
                id="ngo-id"
                type="text"
                placeholder="NGO-IND-2048"
                className={`sp-input ${errors.ngoId ? "sp-input--error" : ""}`}
                {...register("ngoId")}
                aria-describedby="ngo-error"
              />
              {errors.ngoId && (
                <p className="sp-field-error" role="alert" id="ngo-error">
                  <IconAlertCircle /> {errors.ngoId.message}
                </p>
              )}
            </div>

            {/* Verification Notice + Submit — inside last form group visually */}
            <div className="sp-form-group" style={{gap: '20px'}}>
              {VerificationNotice}
              <div className="sp-submit-area" style={{padding: 0}}>
                <button
                  type="submit"
                  className="sp-btn sp-btn--primary sp-btn--submit"
                  id="submit-planting-btn"
                  disabled={false}
                >
                  Submit Planting Record
                </button>
                <p className="sp-submit-support">Submitted for review, not instantly verified</p>
              </div>
            </div>
          </form>

          {/* Right: Summary */}
          {SummaryPanel}
        </div>
      </main>
  );
}
