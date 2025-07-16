#!/usr/bin/env python3
import requests
import json
from datetime import datetime

# Test data
test_narratives = [
    {
        "id": "test-1",
        "createdAt": "2025-01-16T15:30:00Z",
        "narrative": "Reviewed and analyzed contract documents for client merger acquisition",
        "clientCode": "CL-001",
        "matterNumber": "MAT-2025-001",
        "hours": 0.1,
        "status": "draft"
    },
    {
        "id": "test-2",
        "createdAt": "2025-01-16T16:45:00Z",
        "narrative": "Participated in conference call with opposing counsel regarding settlement terms",
        "clientCode": "CL-002",
        "matterNumber": "MAT-2025-002",
        "hours": 0.5,
        "status": "draft"
    },
    {
        "id": "test-3",
        "createdAt": "2025-01-16T17:15:00Z",
        "narrative": "Drafted memorandum on regulatory compliance issues",
        "clientCode": "CL-001",
        "matterNumber": "MAT-2025-003",
        "hours": 1.25,
        "status": "draft"
    }
]

# Make request to export endpoint
url = "http://localhost:5001/api/export/narratives"
headers = {"Content-Type": "application/json"}
payload = {"narratives": test_narratives, "format": "csv"}

try:
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        print("Export successful!")
        print("\nCSV Content:")
        print("-" * 80)
        print(response.text)
        print("-" * 80)
        
        # Save to file for inspection
        with open("test_export_output.csv", "w") as f:
            f.write(response.text)
        print("\nCSV saved to test_export_output.csv")
    else:
        print(f"Export failed with status code: {response.status_code}")
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Error making request: {e}")