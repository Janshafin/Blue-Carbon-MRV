"""Vercel entrypoint for the live Sentinel-2 scoring API."""

from fastapi.middleware.cors import CORSMiddleware

from services.ndvi_scoring.app.main import create_app


app = create_app()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://blue-carbon-mrv.vercel.app"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"service": "Blue Carbon live NDVI scorer", "status": "running"}
