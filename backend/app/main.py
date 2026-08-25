from fastapi import FastAPI

from backend.app.api.v1.submissions import router as submissions_router


app = FastAPI(
    title="Blue Carbon MRV Backend",
    version="0.1.0",
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