from pydantic import BaseModel
from typing import List, Optional, Dict

class ScanRequest(BaseModel):
    path: str

class FileNode(BaseModel):
    id: str
    name: str
    type: str  # "folder" or "file" or "class" or "function"
    children: Optional[List["FileNode"]] = None
    last_analyzed: Optional[str] = None
    calls: Optional[List[str]] = None  # List of function names called by this node
    edges: Optional[List[Dict[str, str]]] = None  # List of resolved edges (only on root?)

FileNode.model_rebuild()
