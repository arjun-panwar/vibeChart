import ast
from typing import List, Optional, Tuple
from backend.schemas import FileNode

def parse_python_file(file_path: str) -> Tuple[List[FileNode], Optional[str]]:
    """
    Parses a Python file to extract classes and functions as FileNodes, 
    and the module-level docstring.

    Args:
        file_path (str): The absolute path to the Python file.

    Returns:
        Tuple[List[FileNode], Optional[str]]: A tuple containing:
            - List of FileNodes (classes/functions)
            - Module docstring (or None if missing)
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        tree = ast.parse(content)
        
        # Extract module docstring
        module_doc = ast.get_docstring(tree)
        
        nodes = []
        
        for item in tree.body:
            node = _process_ast_node(item, file_path)
            if node:
                nodes.append(node)
                
        # Sort nodes: classes first, then functions, alphabetical within type
        nodes.sort(key=lambda x: (x.type != "class", x.name.lower()))
        return nodes, module_doc
        
    except Exception as e:
        # If parsing fails (syntax error, etc.), return empty list
        # We might want to log this in a real app
        return [], None

def _process_ast_node(item, parent_id_prefix: str) -> Optional[FileNode]:
    """
    Recursively processes an AST node to create a FileNode and extract function calls.

    Args:
        item (ast.AST): The AST node to process (ClassDef, FunctionDef, AsyncFunctionDef).
        parent_id_prefix (str): Prefix to generate unique ID (e.g., file path or parent class ID).

    Returns:
        Optional[FileNode]: The constructed FileNode or None if the AST node is not relevant.
    """
    if isinstance(item, ast.ClassDef):
        node_type = "class"
        name = item.name
    elif isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
        node_type = "function"
        name = item.name
    else:
        return None

    # Construct unique ID using :: separator
    # If the prefix already ends with .py, we append ::Name
    # If it already has ::, we append ::Name
    # This assumes parent_id_prefix is the absolute path to file or ID of parent class
    node_id = f"{parent_id_prefix}::{name}"
    
    # Extract docstring
    description = ast.get_docstring(item)
    
    children = []
    
    # If it's a class, we want to look for methods inside
    # If it's a class, we want to look for methods inside
    if isinstance(item, ast.ClassDef):
        for child_item in item.body:
            child_node = _process_ast_node(child_item, node_id)
            if child_node:
                children.append(child_node)
        # Sort methods
        children.sort(key=lambda x: x.name.lower())

    # Extract calls
    calls = set()
    for child in ast.walk(item):
        if isinstance(child, ast.Call):
            if isinstance(child.func, ast.Name):
                calls.add(child.func.id)
            elif isinstance(child.func, ast.Attribute):
                calls.add(child.func.attr)
    
    return FileNode(
        id=node_id,
        name=name,
        type=node_type,
        children=children if children else None,
        calls=list(calls) if calls else None,
        description=description
    )
