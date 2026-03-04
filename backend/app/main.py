import logging
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import projects, simulations, documents, research, geo
from app.api import extraction_status
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Tabu App v2", version="2.0.0")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    logger.error(f"Unhandled: {request.method} {request.url}\n{''.join(tb)}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(simulations.router, prefix="/api/simulations", tags=["simulations"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(extraction_status.router, prefix="/api/projects", tags=["extraction"])
app.include_router(research.router, prefix="/api/projects", tags=["research"])
app.include_router(geo.router, prefix="/api/geo", tags=["geo"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "2.3.0", "build": "2026-03-04-v5-blueline-map"}


# Serve frontend static files in production
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(STATIC_DIR):
    from starlette.responses import FileResponse

    # Serve index.html for SPA routes (must come after API routes)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
else:
    @app.get("/")
    def root():
        return {"status": "ok", "version": "2.0.0"}
