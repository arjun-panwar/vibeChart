import ast
from typing import List, Optional, Tuple
from backend.schemas import FileNode, ImportItem, CallContext

def parse_python_file(file_path: str) -> Tuple[List[FileNode], Optional[str], List[ImportItem]]:
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
        
        visitor = ContextAwareVisitor(file_path)
        visitor.visit(tree)
        
        return visitor.nodes, module_doc, visitor.imports
        
    except Exception as e:
        # If parsing fails (syntax error, etc.), return empty list
        # We might want to log this in a real app
        print(f"Error parsing {file_path}: {e}")
        return [], None, []

class ContextAwareVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.nodes: List[FileNode] = []
        self.scope_stack: List[Dict[str, str]] = [{}] # Stack of variable name -> type name
        self.current_parent_id = file_path
        self.imports: List[ImportItem] = []
        self.current_calls: List[CallContext] = [] # Calls collected for the current node being processed
        
        # We need to collect children for the current node being processed
        self.node_stack: List[FileNode] = [] 

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(ImportItem(module=alias.name, alias=alias.asname))
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        module = node.module
        for alias in node.names:
            self.imports.append(ImportItem(module=module, name=alias.name, alias=alias.asname))
        self.generic_visit(node)

    def visit_Assign(self, node):
        # Track assignments for type inference: x = MyClass()
        if isinstance(node.value, ast.Call):
            type_name = None
            if isinstance(node.value.func, ast.Name):
                type_name = node.value.func.id
            elif isinstance(node.value.func, ast.Attribute):
                # Handle module.Class() -> we just store "Class" or "module.Class" ? 
                # Ideally check imports. For now just store the attribute name
                type_name = node.value.func.attr
            
            if type_name:
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        self.scope_stack[-1][target.id] = type_name
        
        # Track assignments with type hints (simulated here if simple assignment matches known types)
        # Real type hint tracking happens in AnnAssign
        self.generic_visit(node)

    def visit_AnnAssign(self, node):
        # Track annotated assignments: x: MyClass = ...
        if isinstance(node.target, ast.Name):
            var_name = node.target.id
            type_name = None
            if isinstance(node.annotation, ast.Name):
                type_name = node.annotation.id
            elif isinstance(node.annotation, ast.Str):
                type_name = node.annotation.s
            
            if type_name:
                self.scope_stack[-1][var_name] = type_name
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        node_id = f"{self.current_parent_id}::{node.name}"
        file_node = FileNode(
            id=node_id,
            name=node.name,
            type="class",
            children=[],
            description=ast.get_docstring(node),
            imports=[], # items are file-level, but we could scope them? No, imports are usually module level
            unresolved_calls=[]
            # calls field will be populated later based on unresolved_calls
        )
        
        # Push scope
        self.scope_stack.append({})
        
        # Push node context
        previous_parent_id = self.current_parent_id
        self.current_parent_id = node_id
        
        # Collect children
        self.node_stack.append(file_node)
        
        # Visit body
        self.generic_visit(node)
        
        # Pop scope and context
        self.current_parent_id = previous_parent_id
        self.scope_stack.pop()
        self.node_stack.pop()
        
        if self.node_stack:
            # If inside another node (nested class), append to parent
            if self.node_stack[-1].children is None:
                self.node_stack[-1].children = []
            self.node_stack[-1].children.append(file_node)
        else:
            # Top level class
            self.nodes.append(file_node)

    def visit_FunctionDef(self, node):
        self._handle_function(node)

    def visit_AsyncFunctionDef(self, node):
        self._handle_function(node)

    def _handle_function(self, node):
        node_id = f"{self.current_parent_id}::{node.name}"
        file_node = FileNode(
            id=node_id,
            name=node.name,
            type="function",
            children=[], # Functions can have inner functions
            description=ast.get_docstring(node),
            unresolved_calls=[]
        )
        
        # Push scope
        new_scope = {}
        self.scope_stack.append(new_scope)
        
        # Process arguments -> add to scope
        for arg in node.args.args:
            if arg.annotation:
                type_name = None
                if isinstance(arg.annotation, ast.Name):
                    type_name = arg.annotation.id
                elif isinstance(arg.annotation, ast.Str):
                    type_name = arg.annotation.s
                
                if type_name:
                    new_scope[arg.arg] = type_name

        # Push node context
        previous_parent_id = self.current_parent_id
        self.current_parent_id = node_id
        
        self.node_stack.append(file_node)
        
        # Visit body
        self.generic_visit(node)
        
        # Pop scope and context
        self.current_parent_id = previous_parent_id
        self.scope_stack.pop()
        self.node_stack.pop()
        
        if self.node_stack:
            if self.node_stack[-1].children is None:
                self.node_stack[-1].children = []
            self.node_stack[-1].children.append(file_node)
        else:
            self.nodes.append(file_node)

    def visit_Call(self, node):
        # Extract call info
        func_name = None
        receiver_name = None
        inferred_type = None
        
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr
            if isinstance(node.func.value, ast.Name):
                receiver_name = node.func.value.id
                # Look up receiver type in scope
                inferred_type = self._lookup_type(receiver_name)

        if func_name:
            context = CallContext(
                func_name=func_name,
                receiver_name=receiver_name,
                inferred_type=inferred_type,
                lineno=node.lineno
            )
            # Add to current node being processed
            if self.node_stack:
                if self.node_stack[-1].unresolved_calls is None:
                    self.node_stack[-1].unresolved_calls = []
                self.node_stack[-1].unresolved_calls.append(context)
        
        self.generic_visit(node)

    def _lookup_type(self, var_name):
        # Search scope stack in reverse
        for scope in reversed(self.scope_stack):
            if var_name in scope:
                return scope[var_name]
        return None

    def visit_Module(self, node):
         # We need to capture module-level imports into the top-level nodes?
         # Or better, we attach imports to all top-level nodes or handle them separately.
         # For simplicity, we can't attach to FileNode easily as FileNode is usually Class/Func.
         # But the scanner expects 'imports' on the FileNode? 
         # Wait, scanner usually sees a "File" node (from scanner.py) which contains "Class"/"Func" nodes.
         # BUT parse_python_file returns a LIST of FileNodes (classes/funcs).
         # We should attach the imports to EACH top-level node so they have context?
         # Or better: `parse_python_file` returns (nodes, docstring, imports).
         # Let's Modify `parse_python_file` signature? 
         # Implementation Plan said: "Return FileNode populated with unresolved_calls".
         # The `scanner.py` creates the "File" node wrapper. 
         # So we should modify `scanner.py` to accept imports from `parse_python_file`.
         self.generic_visit(node)
