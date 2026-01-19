from pydantic import BaseModel
from typing import List, Optional

class ScanRequest(BaseModel):
    path: str

class FileNode(BaseModel):
    id: str
    name: str
    type: str  # "folder" or "file"
    children: Optional[List["FileNode"]] = None

FileNode.model_rebuild()
