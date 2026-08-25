import React from "react";
import { useNavigate } from "react-router-dom";
import { SubmissionForm } from "../components/SubmissionForm";

export default function SubmitProof() {
  const navigate = useNavigate();

  return (
    <div className="page page--submit">
      <div className="page-header">
        <h1 className="page-title">Submit Planting Proof</h1>
        <p className="page-subtitle">
          Record GPS + photo evidence for the Blue Carbon Registry.
        </p>
      </div>

      <SubmissionForm onSuccess={() => navigate("/history")} />
    </div>
  );
}
