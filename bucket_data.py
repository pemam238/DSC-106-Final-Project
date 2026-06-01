import csv
import json
from collections import defaultdict

data = defaultdict(list)

with open('historical_yearly.csv', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        year = int(float(row['year']))
        data[year].append({
            "lat": float(row['lat']),
            "lon": float(row['lon']),
            "spi": float(row['average_spi'])
        })

with open('historical_yearly.json', 'w') as f:
    json.dump(data, f, separators=(',', ':'))  # compact, no whitespace

print("Done. Years found:", sorted(data.keys())[:5], "...")