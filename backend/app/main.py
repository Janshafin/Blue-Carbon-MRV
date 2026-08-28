import os
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.submissions import router as submissions_router


app = FastAPI(
    title="Blue Carbon MRV Backend",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(
    submissions_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    return {
        "service": "Blue Carbon MRV Backend",
        "status": "running",
    }
