import requests

BASE = "http://localhost:3000"

def show(label, resp):
    print(f"\n--- {label} ---")
    print("status:", resp.status_code)
    try:
        print(resp.json())
    except Exception:
        print(resp.text[:500])

# 1) Simple liveness
show("PING", requests.get(f"{BASE}/api/ping"))

# 2) Search suggestions
show("SEARCH inception", requests.get(f"{BASE}/api/search", params={"q": "inception"}))

# 3) Movie by title
show("MOVIE by title", requests.get(f"{BASE}/api/movie", params={"title": "Inception"}))

# 4) Movie by id (Inception)
show("MOVIE by id", requests.get(f"{BASE}/api/movie", params={"id": "tt1375666"}))
