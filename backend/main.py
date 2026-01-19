from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import ScanRequest, FileNode, ConfigResponse
from backend.services.scanner import (
    scan_directory, 
    ensure_vibechart_folder, 
    save_scan_result, 
    load_scan_result, 
    clear_cache
)
import os
import yaml

app = FastAPI(title="Vibe Chart Backend")

# Allow CORS for development convenience
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/config", response_model=ConfigResponse)
async def get_config():
    """
    Reads config.yaml from the project root and returns it.
    """
    config_path = "config.yaml"  # Assumes running from root
    if not os.path.exists(config_path):
        # Fallback to looking in parent directory if running from backend module
        config_path = "../config.yaml"
    
    default_theme = "light"
    
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                config = yaml.safe_load(f) or {}
                default_theme = config.get("default_theme", "light")
        except Exception as e:
            print(f"Error reading config.yaml: {e}")
            pass

    return ConfigResponse(defaultTheme=default_theme)

@app.post("/scan", response_model=FileNode)
async def scan_path(request: ScanRequest):
    try:
        # 1. Try to load from cache
        cached_result = load_scan_result(request.path)
        if cached_result:
            return cached_result

        # 2. Ensure .vibechart folder exists
        ensure_vibechart_folder(request.path)
        
        # 3. Scan directory
        result = scan_directory(request.path)
        
        # 4. Save result to .vibechart/cache.json
        save_scan_result(request.path, result)
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reanalyze", response_model=FileNode)
async def reanalyze_path(request: ScanRequest):
    try:
        # 1. Clear cache
        clear_cache(request.path)
        
        # 2. Ensure .vibechart folder exists
        ensure_vibechart_folder(request.path)
        
        # 3. Scan directory
        result = scan_directory(request.path)
        
        # 4. Save result to .vibechart/cache.json
        save_scan_result(request.path, result)
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}
