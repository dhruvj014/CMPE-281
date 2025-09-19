import os, sys, json, argparse, requests

BASE = "https://api.themoviedb.org/3"

def load_dotenv(path=".env"):
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s: continue
            k, v = s.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)

def resolve_key(cli_key: str | None):
    if cli_key: return cli_key
    key = os.getenv("TMDB_API_KEY", "").strip()
    if key: return key
    load_dotenv(".env")
    return os.getenv("TMDB_API_KEY", "").strip()

def is_v4_token(key: str) -> bool:
    # v4 tokens are long JWT-looking strings (often start with "eyJ")
    return len(key) > 40 and key[:2].lower() in {"ey"}

def get(url, key, params=None):
    params = dict(params or {})
    headers = {}
    if is_v4_token(key):
        headers["Authorization"] = f"Bearer {key}"
    else:
        params["api_key"] = key
    r = requests.get(url, params=params, headers=headers, timeout=20)
    print(f"\nGET {r.url}\nstatus: {r.status_code}")
    try:
        data = r.json()
    except Exception:
        print(r.text[:400])
        sys.exit(2)
    if r.status_code != 200:
        print(json.dumps(data, indent=2)[:2000])
        sys.exit(2)
    return data

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", help="TMDb key (v3) or v4 Bearer token")
    ap.add_argument("--imdb", default="tt1375666", help="IMDb ID (default: Inception)")
    args = ap.parse_args()

    key = resolve_key(args.key)
    if not key:
        print("TMDB_API_KEY not found. Set env, put it in .env, or pass --key.")
        sys.exit(1)

    masked = (key[:4] + "…" + key[-4:]) if len(key) > 12 else "****"
    print(f"Using TMDb {'v4 token' if is_v4_token(key) else 'v3 key'}: {masked}")

    # 1) Find movie by IMDb ID -> TMDb movie id
    data_find = get(f"{BASE}/find/{args.imdb}", key, params={"external_source": "imdb_id"})
    movie = (data_find.get("movie_results") or [None])[0]
    if not movie:
        print("No movie_results returned. Check the key/token or IMDb ID.")
        sys.exit(3)
    tmdb_id = movie["id"]
    print(f"TMDb movie id: {tmdb_id}  title: {movie.get('title')}")

    # 2) Fetch credits -> show first 3 names + profile_path
    data_cred = get(f"{BASE}/movie/{tmdb_id}/credits", key)
    cast = (data_cred.get("cast") or [])[:3]
    out = [{"name": c.get("name"), "character": c.get("character"), "profile_path": c.get("profile_path")} for c in cast]
    print("\nTop 3 cast:")
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
