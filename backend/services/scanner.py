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
    Ignores directories specified in IGNORE_DIRS.
    Ignores files matching extensions in IGNORE_EXTENSIONS.
    Respects .gitignore rules if present in the root directory.
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
        # Calculate relative path from root to check against spec
        try:
            rel_path = current_path.relative_to(root_path)
            if spec and spec.match_file(str(rel_path)):
                return None
        except ValueError:
            # Should hopefully not happen given we traverse down from root
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
                
                # Sort children: folders first, then files, alphabetically
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

    return _scan(root_path)

def save_scan_result(path: str, data: FileNode) -> str:
    """
    Saves the FileNode data as JSON to .vibechart/structure.json in the target directory.
    Returns the path to the saved file.
    """
    import json
    
    target_path = pathlib.Path(path)
    vibechart_path = target_path / ".vibechart"
    
    if not vibechart_path.exists():
        vibechart_path.mkdir()
    
    output_file = vibechart_path / "structure.json"
    
    with open(output_file, 'w') as f:
        f.write(data.model_dump_json(indent=2))
        
    return str(output_file)
