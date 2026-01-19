import os
import pathlib
from typing import List, Optional
from backend.schemas import FileNode

import pathspec

IGNORE_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", ".env", "dist", "build"}
IGNORE_EXTENSIONS = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp", ".svg",
    # Videos
    ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm"
}

def ensure_vibechart_folder(path: str) -> None:
    """
    Ensures that a hidden .vibechart folder exists in the target directory.
    This folder is used to store cache files.

    Args:
        path (str): The target directory path.
    
    Raises:
        ValueError: If the path is not a valid directory.
    """
    target_path = pathlib.Path(path)
    if not target_path.exists() or not target_path.is_dir():
        raise ValueError(f"Invalid directory path: {path}")

    vibechart_path = target_path / ".vibechart"
    if not vibechart_path.exists():
        vibechart_path.mkdir()

def scan_directory(path: str) -> FileNode:
    """
    Recursively scans a directory to build a file system tree and performs a second pass
    to resolving function calls and data flow edges.

    Args:
        path (str): The absolute path of the directory to scan.

    Returns:
        FileNode: The root node of the scanned directory tree, populated with children
                  and data flow edges (calls).
        
    Raises:
        ValueError: If the path does not exist.
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
        imports = None

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
            description = "Folder"
        # Parse Python files
        elif current_path.suffix == ".py":
            from backend.services.parser import parse_python_file
            children, module_doc, imports = parse_python_file(str(current_path))
            description = module_doc if module_doc else "Python Script"
        else:
            description = "File"
        
        return FileNode(
            id=node_id,
            name=node_name if node_name else str(current_path),
            type=node_type,
            children=children,
            description=description,
            imports=imports
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
    
    
    # 2.5 Build Global Class Index: ClassName -> FilePath
    # This helps resolving "from module import ClassName" to the defining file.
    class_index = {}
    
    def build_class_index(node: FileNode):
        if node.type == "class":
            class_index[node.name] = node.id
        if node.children:
            for child in node.children:
                build_class_index(child)
    
    build_class_index(root_node)

    # 3. Resolve Calls -> Edges
    edges = []
    
    def resolve_calls(node: FileNode, file_imports: Optional[List[object]] = None):
        # Propagate imports down from file node to its children (classes/functions)
        if node.type == "file" and node.imports:
            file_imports = node.imports
            
        if node.unresolved_calls:
            resolved_calls = []
            
            for call_ctx in node.unresolved_calls:
                 # call_ctx has func_name, receiver_name, inferred_type
                 
                 found_target_id = None
                 
                 # Strategy 1: Type-Based Resolution
                 if call_ctx.inferred_type:
                     # 1.1 Check if Type is defined in the current file (or same package logic?)
                     # For now, let's treat inferred_type as a Class Name.
                     
                     # 1.2 Check imports to find where this Type is defined
                     type_def_file = None
                     
                     # Check current file classes
                     # (Simplification: if class_index has it and it shares prefix?)
                     # Better: Check if type is imported
                     
                     if file_imports:
                         for imp in file_imports:
                             if imp.name == call_ctx.inferred_type or imp.alias == call_ctx.inferred_type:
                                 # Found import! "from module import Class" or "import module as alias"
                                 # We need to resolve 'module' to a file path.
                                 # This is hard without full dependency graph.
                                 # Heuristic: Check class_index for the original name
                                 original_name = imp.name if imp.name else call_ctx.inferred_type
                                 if original_name in class_index:
                                     # We have a candidate class!
                                     candidate_id = class_index[original_name]
                                     
                                     # Now look for the function inside this class
                                     # The ID should be candidate_id::func_name
                                     potential_id = f"{candidate_id}::{call_ctx.func_name}"
                                     
                                     # Verify it exists in symbol table
                                     if call_ctx.func_name in symbol_table:
                                         if potential_id in symbol_table[call_ctx.func_name]:
                                             found_target_id = potential_id
                                             break
                     
                     # If still not found, check global class index matching inferred_type name directly
                     if not found_target_id and call_ctx.inferred_type in class_index:
                         candidate_id = class_index[call_ctx.inferred_type]
                         potential_id = f"{candidate_id}::{call_ctx.func_name}"
                         if call_ctx.func_name in symbol_table and potential_id in symbol_table[call_ctx.func_name]:
                             found_target_id = potential_id

                 # Strategy 2: Fallback / Name-Based Resolution (Original Logic + Import Heuristics)
                 if not found_target_id and call_ctx.func_name in symbol_table:
                    target_ids = symbol_table[call_ctx.func_name]
                    
                    # 2.1 Heuristic: Nearest Match (Longest Common Prefix)
                    best_target_id = target_ids[0]
                    max_prefix_len = -1
                    
                    for tid in target_ids:
                        common_len = 0
                        min_len = min(len(node.id), len(tid))
                        while common_len < min_len and node.id[common_len] == tid[common_len]:
                            common_len += 1
                        
                        # Boost score if the target's module is imported in current file
                        # This is a bit tricky with absolute paths. 
                        # We can check if ANY import module matches the target path part.
                        
                        if common_len > max_prefix_len:
                            max_prefix_len = common_len
                            best_target_id = tid
                            
                    found_target_id = best_target_id

                 if found_target_id:
                    resolved_calls.append(found_target_id)
                    
                    if found_target_id != node.id:
                        edges.append({
                            "source": node.id,
                            "target": found_target_id,
                            "id": f"{node.id}-{found_target_id}"
                        })
            
            # Update calls with ONLY resolved IDs
            node.calls = resolved_calls if resolved_calls else None
                        
        if node.children:
            for child in node.children:
                resolve_calls(child, file_imports)
                
    resolve_calls(root_node)
    
    # 4. Attach edges to root
    if edges:
        root_node.edges = edges

    return root_node

def save_scan_result(path: str, data: FileNode) -> str:
    """
    Saves the FileNode data as JSON to .vibechart/cache.json in the target directory,
    injecting the current timestamp.

    Args:
        path (str): The root directory path where .vibechart should exist.
        data (FileNode): The data structure to serialize and save.

    Returns:
        str: The absolute path to the saved cache file.
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

    Args:
        path (str): The root directory path.

    Returns:
        Optional[FileNode]: The loaded FileNode data if cache exists, otherwise None.
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
    Deletes the contents of the .vibechart folder in the target directory, effectively
    clearing the cache.

    Args:
        path (str): The root directory path.
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
