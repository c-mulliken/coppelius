import requests
import json

url = "https://cab.brown.edu/api/"

# Query parameters go in the URL
params = {
    "page": "fose",
    "route": "search",
    "is_ind_study": "N",
    "is_canc": "N"
}

# The search criteria as JSON body
payload = {
    "other": {
        "srcdb": "202520"
    },
    "criteria": [
        {"field": "is_ind_study", "value": "N"},
        {"field": "is_canc", "value": "N"}
    ]
}

headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

print("Sending request...")
response = requests.post(url, params=params, json=payload, headers=headers)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"Count: {data.get('count', 0)}")
    print(f"Results: {len(data.get('results', []))}")
    if data.get('results'):
        print(f"\nFirst course: {json.dumps(data['results'][0], indent=2)}")
else:
    print(f"Response: {response.text}")

# SAMPLE OUTPUT:
# Sending request...
# Status: 200
# Count: 1528
# Results: 1528
# First course: {
#   "key": "1",
#   "code": "AFRI 0005",
#   "title": "Resistance in Black Popular Culture",
#   "crn": "27136",
#   "no": "S01",
#   "total": "1",
#   "schd": "S",
#   "stat": "A",
#   "hide": "",
#   "isCancelled": "",
#   "meets": "TTh 9-10:20a",
#   "mpkey": "2023",
#   "meetingTimes": "[{\"meet_day\":\"1\",\"start_time\":\"900\",\"end_time\":\"1020\"},{\"meet_day\":\"3\",\"start_time\":\"900\",\"end_time\":\"1020\"}]",
#   "instr": "TBD",
#   "start_date": "2026-01-21",
#   "end_date": "2026-05-15",
#   "permreq": "N",
#   "rpt": "N",
#   "cart_opts": "{\"grade_mode\":{\"cart_field\":\"p_gmod\",\"enabled\":true,\"options\":[{\"value\":\"G\",\"label\":\"Standard ABC/No Credit\",\"default\":true,\"selected\":\"selected\"},{\"value\":\"A\",\"label\":\"Audit\",\"default\":false,\"selected\":\"\"},{\"value\":\"S\",\"label\":\"Satisfactory/No Credit\",\"default\":false,\"selected\":\"\"}]},\"credit_hrs\":{\"cartField\":\"p_hours\",\"enabled\":true,\"options\":[{\"value\":\"1\",\"label\":\"1\",\"default\":true,\"selected\":\"selected\"}]},\"swap_section_with\":{\"enabled\":true,\"options\":[{\"value\":\"\",\"label\":\"Not Applicable\",\"default\":true,\"selected\":\"selected\"}]}}",
#   "linked_crns": "",
#   "rfam": "3309",
#   "lrfam": "",
#   "srcdb": "202520",
#   "changehash": "N+63/9pxIJUHmFBXqC93dw"
# }
