from pydantic import BaseModel
from typing import List, Optional, Dict

class ScanRequest(BaseModel):
    """
    Request payload for scanning a directory.
    
    Attributes:
        path (str): The absolute path of the directory to scan.
    """
    path: str

class ConfigResponse(BaseModel):
    """
    Response model for application configuration.
    """
    defaultTheme: str

class ImportItem(BaseModel):
    """
    Represents an imported module or name.
    """
    module: Optional[str] = None # e.g. "os" or "backend.services"
    name: Optional[str] = None   # e.g. "path" or "Scanner" (for from ... import ...)
    alias: Optional[str] = None  # e.g. "p" (for import pandas as p)

class CallContext(BaseModel):
    """
    Represents a function call with context for resolution.
    """
    func_name: str
    receiver_name: Optional[str] = None # e.g. "obj" in "obj.method()"
    inferred_type: Optional[str] = None # e.g. "MyClass"
    lineno: int = 0

class FileNode(BaseModel):
    """
    Represents a node in the file system or code structure graph.
    
    Attributes:
        id (str): Unique identifier for the node (usually file path or symbol ID).
        name (str): Display name of the node.
        type (str): Type of the node (folder, file, class, function).
        children (List[FileNode]): Child nodes (subfolders, files, methods, etc.).
        last_analyzed (str, optional): ISO timestamp of last analysis.
        calls (List[str], optional): List of function names called by code in this node.
        edges (List[Dict], optional): List of resolved data flow edges (root node only).
        description (str, optional): A brief description of the node.
    """
    id: str
    name: str
    type: str  # "folder" or "file" or "class" or "function"
    children: Optional[List["FileNode"]] = None
    last_analyzed: Optional[str] = None
    calls: Optional[List[str]] = None  # List of function IDs called by this node (final resolved IDs)
    unresolved_calls: Optional[List["CallContext"]] = None # Raw call data for resolution phase
    imports: Optional[List["ImportItem"]] = None # List of imports in this file
    edges: Optional[List[Dict[str, str]]] = None  # List of resolved edges (only on root?)
    description: Optional[str] = None

FileNode.model_rebuild()
CallContext.model_rebuild()
ImportItem.model_rebuild()
