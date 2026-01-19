from pydantic import BaseModel
from typing import List, Optional

class ScanRequest(BaseModel):
    path: str

class FileNode(BaseModel):
    id: str
    name: str
    type: str  # "folder" or "file" or "class" or "function"
    children: Optional[List["FileNode"]] = None
    last_analyzed: Optional[str] = None

FileNode.model_rebuild()
