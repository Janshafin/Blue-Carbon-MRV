import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PhotoCapture } from "./PhotoCapture";
import { LocationCapture } from "./LocationCapture";
import { useLocation } from "../hooks/useLocation";
import { createSubmission } from "../services/submissionService";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const TREE_TYPES = ["Rhizophora", "Avicennia", "Sonneratia", "Bruguiera", "Other"] as const;

const formSchema = z
  .object({
    plantedDate: z.string().min(1, "Please select the planting date"),
    treeType: z.enum(TREE_TYPES, { message: "Please select a tree type" }),
    customTreeType: z.string().optional(),
    ngoId: z
      .string()
      .min(2, "NGO ID must be at least 2 characters")
      .max(50, "NGO ID is too long"),
  })
  .refine(
    (data) => {
      if (data.treeType === "Other") {
        return data.customTreeType && data.customTreeType.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please specify the tree type",
      path: ["customTreeType"],
    }
  );

type FormValues = z.infer<typeof formSchema>;

// ─── Submission Phase ─────────────────────────────────────────────────────────

type SubmitPhase =
  | "idle"
  | "saving"
  | "saved"
  | "uploading"
  | "uploaded"
  | "offline_saved";

interface PhaseConfig {
  message: string;
  subMessage?: string;
  icon: string;
  className: string;
}

const phaseConfig: Record<SubmitPhase, PhaseConfig> = {
  idle: { message: "", icon: "", className: "" },
  saving: {
    message: "Saving proof…",
    icon: "💾",
    className: "phase-saving",
  },
  saved: {
    message: "Proof saved on this device.",
    icon: "✅",
    className: "phase-saved",
  },
  uploading: {
    message: "Uploading proof…",
    icon: "⬆️",
    subMessage: "Connecting to server…",
    className: "phase-uploading",
  },
  uploaded: {
    message: "Proof uploaded successfully.",
    icon: "🎉",
    subMessage: "Your submission is on record.",
    className: "phase-uploaded",
  },
  offline_saved: {
    message: "Saved offline.",
    subMessage:
      "It will upload automatically when internet connection returns.",
    icon: "📡",
    className: "phase-offline",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface SubmissionFormProps {
  onSuccess?: () => void;
}

export function SubmissionForm({ onSuccess }: SubmissionFormProps) {
  const isOnline = useOnlineStatus();
  const locationResult = useLocation();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoError, setPhotoError] = useState<string>("");
  const [phase, setPhase] = useState<SubmitPhase>("idle");

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plantedDate: new Date().toISOString().split("T")[0],
      treeType: "Rhizophora",
      ngoId: "",
    },
  });

  const selectedTreeType = watch("treeType");
  const isOther = selectedTreeType === "Other";

  const handlePhotoCapture = (blob: Blob) => {
    setPhoto(blob);
    setPhotoError("");
  };

  const handlePhotoRemove = () => {
    setPhoto(null);
  };

  const onSubmit = async (values: FormValues) => {
    // Validate photo
    if (!photo) {
      setPhotoError("Please take or select a photo of the planted tree.");
      return;
    }

    // Validate location
    if (!locationResult.location) {
      return; // LocationCapture shows the error
    }

    const treeType =
      values.treeType === "Other"
        ? (values.customTreeType?.trim() ?? "Other")
        : values.treeType;

    try {
      // Phase 1: Saving locally
      setPhase("saving");
      await new Promise((r) => setTimeout(r, 400)); // brief pause for UX

      const result = await createSubmission({
        photo,
        location: locationResult.location,
        plantedDate: values.plantedDate,
        treeType,
        ngoId: values.ngoId.trim(),
      });

      // Phase 2: Local save confirmed
      setPhase("saved");
      await new Promise((r) => setTimeout(r, 600));

      if (!isOnline) {
        // Offline: saved locally, will sync later
        setPhase("offline_saved");
      } else {
        // Online: attempt upload
        setPhase("uploading");
        // Wait for sync to complete
        await new Promise((r) => setTimeout(r, 1800));

        if (result.uploadSuccess) {
          setPhase("uploaded");
        } else {
          setPhase("offline_saved");
        }
      }

      // After success, reset form and optionally navigate
      setTimeout(() => {
        reset();
        setPhoto(null);
        setPhase("idle");
        onSuccess?.();
      }, 3000);
    } catch (err) {
      console.error("Submission error:", err);
      setPhase("idle");
    }
  };

  const isDisabled = isSubmitting || phase !== "idle";
  const locationBlocking =
    locationResult.status === "denied" ||
    locationResult.status === "unavailable";

  // ─── Phase overlay ─────────────────────────────────────────────────────────
  if (phase !== "idle") {
    const cfg = phaseConfig[phase];
    const isSpinning = phase === "saving" || phase === "uploading";

    return (
      <div className={`phase-overlay ${cfg.className}`}>
        <div className="phase-content">
          {isSpinning ? (
            <div className="phase-spinner-wrapper">
              <div className="spinner spinner--lg spinner--white"></div>
            </div>
          ) : (
            <div className="phase-icon">{cfg.icon}</div>
          )}
          <h2 className="phase-message">{cfg.message}</h2>
          {cfg.subMessage && (
            <p className="phase-sub">{cfg.subMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="submission-form" noValidate>
      {/* Photo */}
      <section className="form-section">
        <label className="form-label">
          📷 Tree Photo <span className="required">*</span>
        </label>
        <PhotoCapture
          onPhotoCapture={handlePhotoCapture}
          onPhotoRemove={handlePhotoRemove}
          error={photoError}
        />
      </section>

      {/* GPS */}
      <section className="form-section">
        <label className="form-label">
          📍 GPS Location <span className="required">*</span>
        </label>
        <LocationCapture
          locationResult={locationResult}
          error={
            locationBlocking
              ? "Location is required to submit a proof."
              : undefined
          }
        />
      </section>

      {/* Date */}
      <section className="form-section">
        <label htmlFor="plantedDate" className="form-label">
          📅 Date Planted <span className="required">*</span>
        </label>
        <input
          id="plantedDate"
          type="date"
          className={`form-input ${errors.plantedDate ? "form-input--error" : ""}`}
          max={new Date().toISOString().split("T")[0]}
          {...register("plantedDate")}
        />
        {errors.plantedDate && (
          <p className="field-error">{errors.plantedDate.message}</p>
        )}
      </section>

      {/* Tree Type */}
      <section className="form-section">
        <label htmlFor="treeType" className="form-label">
          🌿 Tree Type <span className="required">*</span>
        </label>
        <Controller
          name="treeType"
          control={control}
          render={({ field }) => (
            <div className="tree-type-grid">
              {TREE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`tree-chip ${field.value === type ? "tree-chip--active" : ""}`}
                  onClick={() => field.onChange(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        />
        {errors.treeType && (
          <p className="field-error">{errors.treeType.message}</p>
        )}

        {isOther && (
          <input
            type="text"
            id="customTreeType"
            placeholder="Enter tree species name"
            className={`form-input mt-2 ${errors.customTreeType ? "form-input--error" : ""}`}
            {...register("customTreeType")}
          />
        )}
        {errors.customTreeType && (
          <p className="field-error">{errors.customTreeType.message}</p>
        )}
      </section>

      {/* NGO ID */}
      <section className="form-section">
        <label htmlFor="ngoId" className="form-label">
          🏢 NGO ID <span className="required">*</span>
        </label>
        <input
          id="ngoId"
          type="text"
          placeholder="e.g. NGO-1234"
          className={`form-input ${errors.ngoId ? "form-input--error" : ""}`}
          {...register("ngoId")}
        />
        {errors.ngoId && (
          <p className="field-error">{errors.ngoId.message}</p>
        )}
      </section>

      {/* Offline notice */}
      {!isOnline && (
        <div className="form-offline-note">
          <span>📡</span>
          <span>
            You're offline. Your proof will be saved here and uploaded when
            you're back online.
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        id="submit-proof-btn"
        disabled={isDisabled || locationBlocking}
        className="btn-submit"
      >
        {isDisabled ? (
          <>
            <div className="spinner spinner--sm spinner--white"></div>
            Processing…
          </>
        ) : (
          <>✅ Submit Tree Proof</>
        )}
      </button>
    </form>
  );
}
