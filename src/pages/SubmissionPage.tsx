import "./SubmissionPage.css";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useWallet } from "../hooks/useWallet";
import apiClient, { type VerificationDetail } from "../services/apiClient";
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
    projectName: z.string().optional(),
    plantingDate: z.string().min(1, "Please select the planting date"),
    species: z.enum(MANGROVE_SPECIES, {
      message: "Please select a mangrove species",
    }),
    customSpecies: z.string().optional(),
    ngoId: z
      .string()
      .min(2, "Please enter your NGO ID")
      .max(50, "NGO ID is too long"),
    walletAddress: z
      .string()
      .min(1, "Please provide a beneficiary wallet address")
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 42-character Ethereum address (0x...)"),
    description: z.string().optional(),
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

type PageState = "form" | "submitting" | "verifying" | "error";

interface SuccessData {
  submissionId: string;
  date: string;
  species: string;
  latitude: number;
  longitude: number;
  ngoId: string;
  walletAddress: string;
  projectName: string;
}

// ─── Location hook (self-contained, manual trigger) ──────────────────────────

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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  return { location, status, error, requestLocation, setManualLocation: setLocation };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

function IconSprout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="22" x2="9" y2="22.01" />
      <line x1="15" y1="22" x2="15" y2="22.01" />
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

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconLedger() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
      <circle cx="18" cy="14" r="1" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
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
  onSetLocation: (loc: LocationData) => void;
}

function LocationCaptureBlock({
  location,
  status,
  geoError,
  validationError,
  onRequestLocation,
  onSetLocation,
}: LocationCaptureBlockProps) {
  return (
    <div className="sp-form-group">
      <div className="sp-form-group__header">
        <span className="sp-form-group__icon"><IconMapPin /></span>
        <div>
          <h3 className="sp-form-group__title">Planting Location</h3>
          <p className="sp-form-group__desc">Capture the location where the restoration activity took place.</p>
        </div>
      </div>

      {status === "idle" && !location && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRequestLocation}
            className={`sp-btn sp-btn--primary sp-btn--md ${validationError ? "sp-input--error" : ""}`}
            id="get-location-btn"
          >
            <IconCrosshair />
            <span>Use Current Location</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSetLocation({
                latitude: -3.4653,
                longitude: 114.0917,
                accuracy: 5,
              })
            }
            className="sp-btn sp-btn--secondary sp-btn--md"
            id="set-sample-coords-btn"
          >
            <IconMapPin />
            <span>Load Sample Site (-3.4653°, 114.0917°)</span>
          </button>
        </div>
      )}

      {status === "requesting" && (
        <div className="sp-location-loading">
          <div className="sp-spinner" />
          <span>Acquiring GPS coordinates…</span>
        </div>
      )}

      {location && (
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
              className="sp-btn sp-btn--secondary sp-btn--sm"
              aria-label="Refresh GPS location"
            >
              <IconCrosshair />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      {(status === "denied" || status === "unavailable" || status === "timeout") && !location && (
        <div className="sp-location-error">
          <p className="sp-location-error__msg">{geoError}</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={onRequestLocation} className="sp-btn sp-btn--primary sp-btn--sm">
              <IconCrosshair />
              <span>Try Again</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onSetLocation({
                  latitude: -3.4653,
                  longitude: 114.0917,
                  accuracy: 5,
                })
              }
              className="sp-btn sp-btn--secondary sp-btn--sm"
            >
              <IconMapPin />
              <span>Use Sample Site</span>
            </button>
          </div>
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
  const { walletAddress, connectWallet, isConnecting: walletConnecting, disconnectWallet } = useWallet();

  // Photo state
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  // Location state
  const {
    location: geoLocation,
    status: geoStatus,
    error: geoError,
    requestLocation,
    setManualLocation,
  } = useManualLocation();

  // Page state
  const [pageState, setPageState] = useState<PageState>("form");
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [locationError, setLocationError] = useState("");

  // Live Verification state
  const [verificationData, setVerificationData] = useState<VerificationDetail | null>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      projectName: "",
      plantingDate: "",
      species: undefined,
      customSpecies: "",
      ngoId: "",
      walletAddress: "",
      description: "",
    },
  });

  // Auto-fill connected wallet
  useEffect(() => {
    if (walletAddress) {
      setValue("walletAddress", walletAddress);
    }
  }, [walletAddress, setValue]);

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

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Polling verification state
  useEffect(() => {
    if (pageState !== "verifying" || !successData?.submissionId) return;

    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const ver = await apiClient.getVerification(successData.submissionId);
        if (isMounted) {
          setVerificationData(ver);
          // Stop polling when terminal state reached
          if (["VERIFIED", "CREDITED", "REJECTED", "FAILED"].includes(ver.verification_status)) {
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [pageState, successData]);

  // Summary readiness check
  const summaryReady = useMemo(() => {
    return !!(
      photo &&
      geoLocation &&
      watchedValues.plantingDate &&
      watchedValues.species &&
      (watchedValues.species !== "Other" || watchedValues.customSpecies?.trim()) &&
      watchedValues.ngoId?.trim() &&
      watchedValues.walletAddress?.trim()
    );
  }, [photo, geoLocation, watchedValues]);

  // Submit handler
  const onSubmit = async (values: FormValues) => {
    if (!photo) {
      setPhotoError("Please upload a planting site photo.");
      return;
    }

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
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("latitude", geoLocation.latitude.toString());
      formData.append("longitude", geoLocation.longitude.toString());
      formData.append("planting_date", values.plantingDate);
      formData.append("species", species);
      formData.append("ngo_id", values.ngoId.trim());
      formData.append("wallet_address", values.walletAddress.trim());
      if (values.projectName) {
        formData.append("project_name", values.projectName.trim());
      }
      if (values.description) {
        formData.append("description", values.description.trim());
      }

      const res = await apiClient.submitPlanting(formData);

      setSuccessData({
        submissionId: res.submission_id,
        date: values.plantingDate,
        species,
        latitude: geoLocation.latitude,
        longitude: geoLocation.longitude,
        ngoId: values.ngoId.trim(),
        walletAddress: values.walletAddress.trim(),
        projectName: values.projectName?.trim() || `Mangrove Planting #${res.submission_id.slice(0, 8)}`,
      });

      setPageState("verifying");

      // Initial verification fetch immediately
      try {
        const initialVer = await apiClient.getVerification(res.submission_id);
        setVerificationData(initialVer);
      } catch {
        // Will be picked up by interval
      }
    } catch (err) {
      console.error("Submission error:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setSubmitError(
        isOnline
          ? message
          : "No connection to the verification server. Please check your connection."
      );
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
    setVerificationData(null);
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
        <Link to="/" className="sp-nav__logo">
          <span className="sp-nav__brand">Blue Carbon MRV</span>
        </Link>

        {/* Navigation Links */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            to="/registry"
            className="sp-btn sp-btn--secondary sp-btn--sm"
          >
            <IconLedger />
            <span>Live Registry</span>
          </Link>

          {/* Web3 Wallet Pill */}
          {walletAddress ? (
            <div className="sp-wallet-badge">
              <span className="sp-wallet-dot" />
              <span>
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
              <button
                type="button"
                onClick={disconnectWallet}
                title="Disconnect Wallet"
                className="sp-wallet-disconnect"
                aria-label="Disconnect wallet"
              >
                <IconX />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectWallet}
              disabled={walletConnecting}
              className="sp-btn sp-btn--wallet sp-btn--sm"
              id="connect-wallet-btn"
            >
              <IconWallet />
              <span>{walletConnecting ? "Connecting…" : "Connect Wallet"}</span>
            </button>
          )}

          <div className="sp-nav__ngo">
            <div className="sp-nav__avatar">N</div>
            <div className="sp-nav__ngo-info">
              <span className="sp-nav__ngo-id">NGO Registry</span>
              <span className="sp-nav__verified">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );

  // ─── Hero ───────────────────────────────────────────────────────────────────

  const Hero = (
    <section className="sp-hero">
      <span className="sp-hero__tag">FIELD RECORD · MANGROVE RESTORATION</span>
      <h1 className="sp-hero__title">Submit Mangrove Planting Proof</h1>
      <p className="sp-hero__subtitle">
        Record your restoration activity with verified GPS location, planting details and photographic evidence for Sentinel-2 satellite MRV &amp; Sepolia blockchain credits.
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
        <div className="sp-summary__divider" />
        <div className="sp-summary__item">
          <span className="sp-summary__item-label">Beneficiary</span>
          <span className="sp-summary__item-value" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
            {watchedValues.walletAddress
              ? `${watchedValues.walletAddress.slice(0, 6)}…${watchedValues.walletAddress.slice(-4)}`
              : <span className="sp-summary__placeholder">Not provided</span>}
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
        <h3 className="sp-trust__title">Full-Pipeline MRV Telemetry</h3>
        <p className="sp-trust__text">
          Once submitted, Sentinel-2 satellite imagery analyzes multi-spectral NDVI canopy changes. Eligible records automatically initiate minting on the Sepolia smart contract.
        </p>
      </div>
    </div>
  );

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
            <h1 className="sp-success-card__title">Submitting Proof…</h1>
            <p className="sp-success-card__subtitle">
              Uploading photo, extracting EXIF coordinates, and queueing Sentinel-2 satellite analysis.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ─── Live Verifying & Telemetry Dashboard (Phases 11 & 13) ──────────────────

  if (pageState === "verifying" && successData) {
    const status = verificationData?.verification_status || "PROCESSING";
    const isCompleted = ["VERIFIED", "CREDITED", "REJECTED", "FAILED"].includes(status);
    const isApproved = status === "VERIFIED" || status === "CREDITED";

    return (
      <div className="sp-page">
        <div className="sp-global-bg" aria-hidden="true" />
        {Navbar}

        <main className="sp-success-page" style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
          <div className="sp-success-card" style={{ maxWidth: "100%", textAlign: "left" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    background: isApproved
                      ? "rgba(34, 197, 94, 0.2)"
                      : status === "REJECTED"
                      ? "rgba(239, 68, 68, 0.2)"
                      : "rgba(56, 189, 248, 0.2)",
                    color: isApproved ? "#4ade80" : status === "REJECTED" ? "#f87171" : "#38bdf8",
                    border: `1px solid ${
                      isApproved
                        ? "rgba(34, 197, 94, 0.4)"
                        : status === "REJECTED"
                        ? "rgba(239, 68, 68, 0.4)"
                        : "rgba(56, 189, 248, 0.4)"
                    }`,
                  }}
                >
                  {status}
                </span>
                <h1 className="sp-success-card__title" style={{ fontSize: "1.6rem", marginTop: "8px", marginBottom: "4px" }}>
                  {successData.projectName}
                </h1>
                <span style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>
                  Submission ID: {successData.submissionId}
                </span>
              </div>

              {!isCompleted && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8" }}>
                  <div className="sp-spinner" />
                  <span style={{ fontSize: "0.85rem" }}>Live MRV Engine…</span>
                </div>
              )}
            </div>

            {/* Pipeline Stage Stepper */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
                background: "rgba(15, 23, 42, 0.6)",
                padding: "12px",
                borderRadius: "12px",
                marginBottom: "24px",
                fontSize: "0.75rem",
              }}
            >
              <div style={{ color: "#4ade80", fontWeight: 600 }}>✅ 1. Proof Uploaded</div>
              <div
                style={{
                  color:
                    status === "SATELLITE_ANALYSIS" || verificationData?.ndvi_before !== null
                      ? "#4ade80"
                      : "#94a3b8",
                  fontWeight: 600,
                }}
              >
                {verificationData?.ndvi_before !== null ? "✅" : "⏳"} 2. Satellite Telemetry
              </div>
              <div
                style={{
                  color: verificationData?.score !== null ? "#4ade80" : "#94a3b8",
                  fontWeight: 600,
                }}
              >
                {verificationData?.score !== null ? "✅" : "⏳"} 3. Plausibility Score
              </div>
              <div
                style={{
                  color:
                    verificationData?.blockchain_status === "provisional"
                      ? "#4ade80"
                      : verificationData?.blockchain_status === "failed"
                      ? "#f87171"
                      : "#94a3b8",
                  fontWeight: 600,
                }}
              >
                {verificationData?.blockchain_status === "provisional" ? "✅" : "⏳"} 4. Sepolia Token
              </div>
            </div>

            {/* Satellite & NDVI Display (Phase 13) */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "1rem", color: "#f1f5f9", marginBottom: "12px" }}>
                🛰️ Sentinel-2 Satellite Vegetation Telemetry
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(56, 189, 248, 0.08)",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>BASELINE NDVI (PRE-PLANTING)</span>
                  <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#38bdf8", marginTop: "4px" }}>
                    {verificationData?.ndvi_before !== null && verificationData?.ndvi_before !== undefined
                      ? verificationData.ndvi_before.toFixed(4)
                      : "Analyzing…"}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Planting window ±30 days</span>
                </div>

                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.2)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>CURRENT NDVI (MONITORING)</span>
                  <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#4ade80", marginTop: "4px" }}>
                    {verificationData?.ndvi_after !== null && verificationData?.ndvi_after !== undefined
                      ? verificationData.ndvi_after.toFixed(4)
                      : "Analyzing…"}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Recent 30-day window</span>
                </div>

                <div
                  style={{
                    background: "rgba(168, 85, 247, 0.08)",
                    border: "1px solid rgba(168, 85, 247, 0.2)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>NDVI IMPROVEMENT (DELTA)</span>
                  <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#c084fc", marginTop: "4px" }}>
                    {verificationData?.ndvi_change !== null && verificationData?.ndvi_change !== undefined
                      ? `+${verificationData.ndvi_change.toFixed(4)}`
                      : "Calculating…"}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Canopy growth index</span>
                </div>
              </div>

              {/* Imagery source badge */}
              <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "#94a3b8" }}>
                Source:{" "}
                <span style={{ color: "#38bdf8" }}>
                  {verificationData?.satellite_imagery_information?.source || "Sentinel-2 L2A"}
                </span>
                {verificationData?.satellite_imagery_information?.is_simulated && (
                  <span
                    style={{
                      marginLeft: "8px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "rgba(234, 179, 8, 0.15)",
                      color: "#facc15",
                      fontSize: "0.7rem",
                    }}
                  >
                    MOCK_NDVI Mode
                  </span>
                )}
              </div>
            </div>

            {/* Plausibility Score & Eligibility */}
            <div
              style={{
                background: "rgba(10, 25, 35, 0.9)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "14px",
                padding: "18px 20px",
                marginBottom: "24px",
                display: "flex",
                flexWrap: "wrap",
                gap: "20px",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>VERIFICATION SCORE</span>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#38bdf8" }}>
                  {verificationData?.score !== null && verificationData?.score !== undefined
                    ? verificationData.score
                    : "—"}
                  <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 400 }}> / 100</span>
                </div>
                <span style={{ fontSize: "0.8rem", color: "#4ade80" }}>
                  Confidence: {verificationData?.confidence || "evaluating…"}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>ELIGIBILITY DECISION</span>
                <div style={{ marginTop: "4px" }}>
                  {verificationData?.eligibility ? (
                    <span
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        background: "rgba(34, 197, 94, 0.2)",
                        color: "#4ade80",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
                      }}
                    >
                      Eligible for Provisional Minting
                    </span>
                  ) : status === "REJECTED" ? (
                    <span
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#f87171",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      Ineligible (Requires Review)
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Evaluating eligibility…</span>
                  )}
                </div>
              </div>
            </div>

            {/* Blockchain Transaction Card (Phase 9) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: "14px",
                padding: "18px 20px",
                marginBottom: "24px",
              }}
            >
              <h3 style={{ fontSize: "1rem", color: "#f1f5f9", marginBottom: "10px" }}>
                ⛓️ Sepolia Testnet Blockchain Record
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Smart Contract</span>
                  <span style={{ color: "#f1f5f9", fontFamily: "monospace" }}>
                    0x815F9122D29471e161D66068Eef9a508EC079442
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Beneficiary Wallet</span>
                  <span style={{ color: "#38bdf8", fontFamily: "monospace" }}>
                    {successData.walletAddress}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8" }}>Blockchain Status</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background:
                        verificationData?.blockchain_status === "provisional"
                          ? "rgba(34, 197, 94, 0.2)"
                          : "rgba(56, 189, 248, 0.2)",
                      color:
                        verificationData?.blockchain_status === "provisional" ? "#4ade80" : "#38bdf8",
                    }}
                  >
                    {verificationData?.blockchain_status || "unregistered"}
                  </span>
                </div>

                {verificationData?.transaction_hash && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "6px",
                      paddingTop: "6px",
                      borderTop: "1px solid rgba(56, 189, 248, 0.1)",
                    }}
                  >
                    <span style={{ color: "#94a3b8" }}>Transaction Hash</span>
                    <a
                      href={`https://eth-sepolia.blockscout.com/tx/${verificationData.transaction_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#38bdf8", textDecoration: "underline", fontFamily: "monospace" }}
                    >
                      {verificationData.transaction_hash.slice(0, 10)}…
                      {verificationData.transaction_hash.slice(-8)} ↗
                    </a>
                  </div>
                )}

                {verificationData?.blockchain_error && (
                  <div style={{ color: "#fca5a5", fontSize: "0.8rem", marginTop: "6px" }}>
                    ℹ️ {verificationData.blockchain_error}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleReset}
                className="sp-btn sp-btn--secondary sp-btn--md"
              >
                <IconPlus />
                <span>Submit Another Record</span>
              </button>
              <Link
                to="/registry"
                className="sp-btn sp-btn--primary sp-btn--md"
              >
                <span>View on Live Registry</span>
                <IconExternal />
              </Link>
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
              <button type="button" onClick={handleRetry} className="sp-btn sp-btn--primary">
                Try Again
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Form Page ──────────────────────────────────────────────────────────────

  return (
    <div className="sp-page">
      <div className="sp-global-bg" aria-hidden="true" />
      {Navbar}
      {Hero}

      <main className="sp-main">
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
              onSetLocation={setManualLocation}
            />

            {/* 3. Planting Date */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconCalendar /></span>
                <div>
                  <h3 className="sp-form-group__title">Planting Date</h3>
                  <p className="sp-form-group__desc">When were the mangrove saplings planted at this location?</p>
                </div>
              </div>
              <input
                id="planting-date"
                type="date"
                max={new Date().toISOString().split("T")[0]}
                className={`sp-input ${errors.plantingDate ? "sp-input--error" : ""}`}
                {...register("plantingDate")}
                aria-describedby="planting-date-error"
              />
              {errors.plantingDate && (
                <p className="sp-field-error" role="alert" id="planting-date-error">
                  <IconAlertCircle /> {errors.plantingDate.message}
                </p>
              )}
            </div>

            {/* 4. Mangrove Species */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconSprout /></span>
                <div>
                  <h3 className="sp-form-group__title">Mangrove Species</h3>
                  <p className="sp-form-group__desc">Identify the primary mangrove species planted in this record.</p>
                </div>
              </div>
              <Controller
                name="species"
                control={control}
                render={({ field }) => (
                  <div className="sp-select-wrapper">
                    <select
                      id="mangrove-species"
                      className={`sp-select ${errors.species ? "sp-select--error" : ""}`}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value as (typeof MANGROVE_SPECIES)[number])}
                      aria-describedby="species-error"
                    >
                      <option value="" disabled>Select mangrove species…</option>
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
                placeholder="NGO-BORNEO-2026"
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

            {/* 6. Beneficiary Wallet Address (Phase 9) */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconWallet /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 className="sp-form-group__title">Beneficiary Ethereum Wallet</h3>
                    {walletAddress && (
                      <button
                        type="button"
                        onClick={() => setValue("walletAddress", walletAddress)}
                        className="sp-btn sp-btn--secondary sp-btn--sm"
                        id="use-connected-wallet-btn"
                      >
                        <IconCheck />
                        <span>Use Connected ({walletAddress.slice(0, 6)}…)</span>
                      </button>
                    )}
                  </div>
                  <p className="sp-form-group__desc">
                    The Sepolia wallet address that will receive the provisional Blue Carbon Credits (BCC).
                  </p>
                </div>
              </div>
              <input
                id="wallet-address"
                type="text"
                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                className={`sp-input ${errors.walletAddress ? "sp-input--error" : ""}`}
                {...register("walletAddress")}
                aria-describedby="wallet-error"
                style={{ fontFamily: "monospace" }}
              />
              {errors.walletAddress && (
                <p className="sp-field-error" role="alert" id="wallet-error">
                  <IconAlertCircle /> {errors.walletAddress.message}
                </p>
              )}
            </div>

            {/* 7. Optional Project Name */}
            <div className="sp-form-group">
              <div className="sp-form-group__header">
                <span className="sp-form-group__icon"><IconTag /></span>
                <div>
                  <h3 className="sp-form-group__title">Project Name (Optional)</h3>
                  <p className="sp-form-group__desc">Custom identifier for this restoration site in the live registry.</p>
                </div>
              </div>
              <input
                id="project-name"
                type="text"
                placeholder="East Kalimantan Estuary Restoration #1"
                className="sp-input"
                {...register("projectName")}
              />
            </div>

            {/* Verification Notice + Submit */}
            <div className="sp-form-group" style={{ gap: "20px" }}>
              {VerificationNotice}
              <div className="sp-submit-area" style={{ padding: 0 }}>
                <button
                  type="submit"
                  className="sp-btn sp-btn--primary sp-btn--submit"
                  id="submit-planting-btn"
                >
                  Submit Planting Record
                </button>
                <p className="sp-submit-support">Submits evidence for Sentinel-2 satellite analysis &amp; on-chain registry</p>
              </div>
            </div>
          </form>

          {/* Right: Summary */}
          {SummaryPanel}
        </div>
      </main>

      {/* Footer */}
      <footer className="sp-footer">
        <div className="sp-footer__inner">
          <p className="sp-footer__text">Blue Carbon MRV · Blockchain-Based Registry</p>
          <p className="sp-footer__text">Sentinel-2 Telemetry · Ethereum Sepolia Testnet</p>
        </div>
      </footer>
    </div>
  );
}
