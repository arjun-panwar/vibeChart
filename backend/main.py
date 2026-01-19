from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import ScanRequest, FileNode
from backend.services.scanner import scan_directory, ensure_vibechart_folder, save_scan_result
import os

app = FastAPI(title="Vibe Chart Backend")

# Allow CORS for development convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/scan", response_model=FileNode)
async def scan_path(request: ScanRequest):
    try:
        # 1. Ensure .vibechart folder exists
        ensure_vibechart_folder(request.path)
        
        # 2. Scan directory
        result = scan_directory(request.path)
        
        # 3. Save result to .vibechart/structure.json
        save_scan_result(request.path, result)
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}
