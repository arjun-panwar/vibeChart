import requests
import json

try:
    response = requests.post(
        "http://localhost:8000/scan",
        json={"path": "/home/arjun/Documents/presonal/vision-pipeline-qa"},
        timeout=10
    )
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Response specific keys verification:")
        print(f"Root path: {data.get('name')}")
        print(f"Children count: {len(data.get('children', []))}")
        # Check if .vibechart is creating
        import pathlib
        print(f".vibechart exists: {pathlib.Path('/home/arjun/Documents/presonal/vision-pipeline-qa/.vibechart').exists()}")
    else:
        print(response.text)
except Exception as e:
    print(e)
