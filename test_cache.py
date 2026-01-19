import requests
import json
import time

URL_SCAN = "http://localhost:8000/scan"
URL_REANALYZE = "http://localhost:8000/reanalyze"
PATH = "/home/arjun/Documents/presonal/vision-qa"

def test_cache():
    print("--- Test 1: Initial Scan ---")
    resp1 = requests.post(URL_REANALYZE, json={"path": PATH}) # Start fresh
    data1 = resp1.json()
    ts1 = data1.get("last_analyzed")
    print(f"Timestamp 1: {ts1}")
    
    print("\n--- Test 2: Cached Scan ---")
    time.sleep(1.1)
    resp2 = requests.post(URL_SCAN, json={"path": PATH})
    data2 = resp2.json()
    ts2 = data2.get("last_analyzed")
    print(f"Timestamp 2: {ts2}")
    
    if ts1 == ts2:
        print("SUCCESS: Timestamps match (Served from cache)")
    else:
        print("FAILURE: Timestamps differ")

    print("\n--- Test 3: Reanalyze ---")
    time.sleep(1.1)
    resp3 = requests.post(URL_REANALYZE, json={"path": PATH})
    data3 = resp3.json()
    ts3 = data3.get("last_analyzed")
    print(f"Timestamp 3: {ts3}")
    
    if ts3 != ts2:
        print("SUCCESS: Timestamp updated (Fresh scan)")
    else:
        print("FAILURE: Timestamp did not update")

if __name__ == "__main__":
    test_cache()
