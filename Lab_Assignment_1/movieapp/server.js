// server.js
// Simple Express backend that proxies OMDb, serves the front-end locally,
// provides type-ahead search, movie details, and a CPU spike endpoint.
// Load environment variables first
try { require('dotenv').config(); } catch {}

if (typeof fetch !== 'function') {
  globalThis.fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
}

const TMDB_KEY = process.env.TMDB_API_KEY || '';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w185';

console.log('TMDB_API_KEY present?', !!process.env.TMDB_API_KEY);
console.log('TMDB_KEY value:', TMDB_KEY ? 'Set' : 'Empty');

const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OMDB_KEY = process.env.OMDB_API_KEY;
if (!OMDB_KEY) {
  console.error('Missing OMDB_API_KEY (set it in .env)'); process.exit(1);
}

// access log (local file)
const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const accessLog = fs.createWriteStream(path.join(logDir, 'access.log'), { flags: 'a' });
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms', { stream: accessLog }));

// serve front-end locally
app.use(express.static(path.join(__dirname, 'public')));

async function fetchActorFacesByImdb(imdbID){
  if (!TMDB_KEY) {
    console.log('No TMDB key, skipping actor photos');
    return [];
  }

  try {
    const findUrl = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbID)}?api_key=${TMDB_KEY}&external_source=imdb_id`;
    console.log('Fetching TMDB data for:', imdbID);

    const r1 = await fetch(findUrl);
    const d1 = await r1.json();

    if (!r1.ok) {
      console.error('TMDB find API error:', d1);
      return [];
    }

    const movie = (d1.movie_results && d1.movie_results[0]) || null;
    if (!movie) {
      console.log('No TMDB movie found for:', imdbID);
      return [];
    }

    const credUrl = `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_KEY}`;
    const r2 = await fetch(credUrl);
    const d2 = await r2.json();

    if (!r2.ok) {
      console.error('TMDB credits API error:', d2);
      return [];
    }

    const cast = Array.isArray(d2.cast) ? d2.cast.slice(0,3) : [];
    console.log(`Found ${cast.length} actors for ${imdbID}`);

    return cast.map(c => ({
      name: c.name,
      character: c.character || 'Actor',
      photo: c.profile_path ? `${TMDB_IMG_BASE}${c.profile_path}` : null
    }));
  } catch (error) {
    console.error('Error fetching actor faces:', error);
    return [];
  }
}

app.get('/api/ping', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Type-ahead search
app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });
    const r = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(q)}&type=movie&page=1`);
    const data = await r.json();
    if (data.Response === 'False' || !data.Search) return res.json({ results: [] });
    const results = data.Search.slice(0, 8).map(it => ({
      title: it.Title,
      year: it.Year,
      imdbID: it.imdbID,
      poster: it.Poster && it.Poster !== 'N/A' ? it.Poster : null
    }));
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: 'search_failed' });
  }
});

// Movie details (by id or title)
app.get('/api/movie', async (req, res) => {
  try {
    const id = String(req.query.id || '').trim();
    const title = String(req.query.title || '').trim();
    if (!id && !title) return res.status(400).json({ error: 'missing_id_or_title' });

    const query = id ? `i=${encodeURIComponent(id)}` : `t=${encodeURIComponent(title)}`;
    const r = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_KEY}&${query}&plot=short`);
    const data = await r.json();
    if (data.Response === 'False') return res.status(404).json({ error: 'not_found' });

    const imdbID = data.imdbID;
    let actors = await fetchActorFacesByImdb(imdbID);
    if (!actors.length) {
      // fallback to OMDb top 3 names (no photos)
      actors = (data.Actors || '')
        .split(',').map(s => s.trim()).filter(Boolean).slice(0,3)
        .map(name => ({ name, character: 'Actor', photo: null }));
    }

    res.json({
      title: data.Title, year: data.Year,
      poster: data.Poster && data.Poster !== 'N/A' ? data.Poster : null,
      genre: data.Genre, rated: data.Rated, runtime: data.Runtime,
      imdbID, actors
    });
  } catch {
    res.status(500).json({ error: 'movie_failed' });
  }
});

// Debug endpoint to test TMDB directly
app.get('/api/debug-tmdb/:imdbId', async (req, res) => {
  const imdbID = req.params.imdbId;

  if (!TMDB_KEY) {
    return res.json({ error: 'No TMDB key configured' });
  }

  try {
    // Step 1: Find movie by IMDB ID
    const findUrl = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbID)}?api_key=${TMDB_KEY}&external_source=imdb_id`;
    console.log('Find URL:', findUrl);

    const r1 = await fetch(findUrl);
    const d1 = await r1.json();

    console.log('TMDB Find Response:', JSON.stringify(d1, null, 2));

    if (!r1.ok) {
      return res.json({ error: 'TMDB find failed', response: d1 });
    }

    const movie = (d1.movie_results && d1.movie_results[0]) || null;
    if (!movie) {
      return res.json({ error: 'No movie found in TMDB', findResponse: d1 });
    }

    // Step 2: Get credits
    const credUrl = `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_KEY}`;
    console.log('Credits URL:', credUrl);

    const r2 = await fetch(credUrl);
    const d2 = await r2.json();

    console.log('TMDB Credits Response:', JSON.stringify(d2, null, 2));

    const cast = Array.isArray(d2.cast) ? d2.cast.slice(0, 5) : [];

    res.json({
      imdbID,
      tmdbMovie: movie,
      cast: cast.map(c => ({
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
        full_photo_url: c.profile_path ? `${TMDB_IMG_BASE}${c.profile_path}` : null
      }))
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.json({ error: error.message });
  }
});

// Spike CPU for X milliseconds (default 5000ms) – demonstration for CloudWatch
app.get('/api/spike', (req, res) => {
  const ms = Math.min(20000, Math.max(500, Number(req.query.ms || 5000))); // clamp 0.5s–20s
  const end = Date.now() + ms;
  let x = 0;
  while (Date.now() < end) {
    // pointless math to burn CPU
    x += Math.sqrt(Math.random()) * Math.sqrt(Math.random());
  }
  res.json({ spikedMs: ms, dummy: x });
});

app.listen(PORT, () => console.log(`Movie app listening on http://localhost:${PORT}`));