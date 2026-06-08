import urllib.request
import urllib.parse
import json

# Test 1: with camelCase params
url1 = 'http://localhost:5000/api/summary?group=&startDate=2026-06-01&endDate=2026-06-07'
# Test 2: with underscore params
url2 = 'http://localhost:5000/api/summary?group=&start_date=2026-06-01&end_date=2026-06-07'

for name, url in [('camelCase', url1), ('underscore', url2)]:
    print(f'\n=== Testing {name} ===')
    url_encoded = urllib.parse.quote(url, safe='/:?=&')
    try:
        resp = urllib.request.urlopen(url_encoded)
        data = json.loads(resp.read())
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except urllib.error.HTTPError as e:
        print(f'HTTP Error: {e.code}')
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f'Error: {e}')
