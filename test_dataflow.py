import requests
import json
import time

URL_REANALYZE = "http://localhost:8000/reanalyze"
PATH = "/home/arjun/Documents/presonal/vision-qa"

def test_dataflow():
    print("--- Test Data Flow ---")
    resp = requests.post(URL_REANALYZE, json={"path": PATH})
    data = resp.json()
    
    edges = data.get("edges", [])
    print(f"Total Edges Found: {len(edges)}")
    
    if edges:
        print("Sample Edges:")
        for edge in edges[:5]:
            print(f"  {edge['source']} -> {edge['target']}")
    else:
        print("WARNING: No edges found. Check if the codebase has calls.")

    # Check a known file for calls
    # We know update_bbox_counts.py exists. Let's find it.
    def find_node(node, name):
        if node['name'] == name: return node
        if node['children']:
            for child in node['children']:
                found = find_node(child, name)
                if found: return found
        return None

    target = find_node(data, "update_bbox_counts.py")
    if target:
        print("\nFound update_bbox_counts.py")
        # Check kids for calls
        if target.get('children'):
            for kid in target['children']:
                if kid.get('calls'):
                    print(f"  Function {kid['name']} calls: {kid['calls']}")
    else:
        print("Could not find update_bbox_counts.py to verify calls.")

if __name__ == "__main__":
    test_dataflow()
