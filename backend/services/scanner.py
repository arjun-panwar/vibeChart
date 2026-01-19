import os
import pathlib
from typing import List, Optional
from backend.schemas import FileNode

import pathspec

IGNORE_DIRS = {".git", "__pycache__"}
IGNORE_EXTENSIONS = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp", ".svg",
    # Videos
    ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm"
}

def ensure_vibechart_folder(path: str) -> None:
    """
    Ensures that a hidden .vibechart folder exists in the target directory.
    """
    target_path = pathlib.Path(path)
    if not target_path.exists() or not target_path.is_dir():
        raise ValueError(f"Invalid directory path: {path}")

    vibechart_path = target_path / ".vibechart"
    if not vibechart_path.exists():
        vibechart_path.mkdir()

def scan_directory(path: str) -> FileNode:
    """
    Recursively scans the directory and returns a JSON tree structure.
    Also resolves function calls to create edges (Data Flow).
    """
    root_path = pathlib.Path(path).resolve()
    
    if not root_path.exists():
        raise ValueError(f"Path does not exist: {path}")

    # Load .gitignore patterns if available
    gitignore_path = root_path / ".gitignore"
    spec = None
    if gitignore_path.exists():
        try:
            with open(gitignore_path, "r") as fh:
                spec = pathspec.PathSpec.from_lines("gitwildmatch", fh)
        except Exception:
            pass  # Fail gracefully if gitignore cannot be read

    def _scan(current_path: pathlib.Path) -> Optional[FileNode]:
        # Check against IGNORE_DIRS
        if current_path.name in IGNORE_DIRS:
            return None
            
        # Check against IGNORE_EXTENSIONS
        if current_path.suffix.lower() in IGNORE_EXTENSIONS:
            return None

        # Check against .gitignore
        try:
            rel_path = current_path.relative_to(root_path)
            if spec and spec.match_file(str(rel_path)):
                return None
        except ValueError:
            pass

        node_name = current_path.name
        node_type = "folder" if current_path.is_dir() else "file"
        node_id = str(current_path)

        children: Optional[List[FileNode]] = None

        if current_path.is_dir():
            children = []
            try:
                for entry in os.scandir(current_path):
                    entry_path = pathlib.Path(entry.path)
                    child_node = _scan(entry_path)
                    if child_node:
                        children.append(child_node)
                
                children.sort(key=lambda x: (x.type != "folder", x.name.lower()))
            except PermissionError:
                pass
        # Parse Python files
        elif current_path.suffix == ".py":
            from backend.services.parser import parse_python_file
            children = parse_python_file(str(current_path))
        
        return FileNode(
            id=node_id,
            name=node_name if node_name else str(current_path),
            type=node_type,
            children=children
        )

    # 1. First pass: Scan structure
    root_node = _scan(root_path)
    if not root_node:
        return root_node

    # --- Data Flow Resolution ---
    
    # 2. Build Symbol Table: Name -> List[ID]
    symbol_table = {}
    
    def build_symbol_table(node: FileNode):
        if node.type in ["class", "function"]:
            if node.name not in symbol_table:
                symbol_table[node.name] = []
            symbol_table[node.name].append(node.id)
            
        if node.children:
            for child in node.children:
                build_symbol_table(child)
                
    build_symbol_table(root_node)
    
    # 3. Resolve Calls -> Edges
    edges = []
    
    def resolve_calls(node: FileNode):
        if node.calls:
            for call_name in node.calls:
                # Naive resolution: find first match in symbol table
                if call_name in symbol_table:
                    target_ids = symbol_table[call_name]
                    target_id = target_ids[0]
                    
                    if target_id != node.id:
                        edges.append({
                            "source": node.id,
                            "target": target_id,
                            "id": f"{node.id}-{target_id}"
                        })
                        
        if node.children:
            for child in node.children:
                resolve_calls(child)
                
    resolve_calls(root_node)
    
    # 4. Attach edges to root
    if edges:
        root_node.edges = edges

    return root_node

def save_scan_result(path: str, data: FileNode) -> str:
    """
    Saves the FileNode data as JSON to .vibechart/cache.json in the target directory.
    Injects a timestamp.
    Returns the path to the saved file.
    """
    import json
    from datetime import datetime
    
    # Add timestamp
    data.last_analyzed = datetime.now().isoformat()
    
    target_path = pathlib.Path(path)
    vibechart_path = target_path / ".vibechart"
    
    if not vibechart_path.exists():
        vibechart_path.mkdir()
    
    output_file = vibechart_path / "cache.json"
    
    with open(output_file, 'w') as f:
        f.write(data.model_dump_json(indent=2))
        
    return str(output_file)

def load_scan_result(path: str) -> Optional[FileNode]:
    """
    Loads scan result from .vibechart/cache.json if it exists.
    """
    import json
    target_path = pathlib.Path(path)
    cache_file = target_path / ".vibechart" / "cache.json"
    
    if cache_file.exists():
        try:
            with open(cache_file, 'r') as f:
                data = json.load(f)
                return FileNode(**data)
        except Exception:
            pass # Invalid cache, ignore
            
    return None

def clear_cache(path: str) -> None:
    """
    Deletes the contents of the .vibechart folder in the target directory.
    """
    import shutil
    target_path = pathlib.Path(path)
    vibechart_path = target_path / ".vibechart"
    
    if vibechart_path.exists() and vibechart_path.is_dir():
        for item in vibechart_path.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
