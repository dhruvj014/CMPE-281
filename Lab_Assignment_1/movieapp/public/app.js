const q = document.getElementById('q');
const clearBtn = document.getElementById('clearBtn');
const sug = document.getElementById('suggestions');
const result = document.getElementById('result');
const searchBtn = document.getElementById('searchBtn');   // NEW
const ping = document.getElementById('ping');

let items = [];
let active = -1;
let lastFetch = 0;

function debounce(fn, ms=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

function initials(name){
    return name.split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase();
}


function showSuggestions(list){
  sug.innerHTML = '';
  if (!list.length){ sug.classList.remove('show'); return; }
  list.forEach((it, i)=>{
    const li = document.createElement('li');
    li.setAttribute('role','option');
    li.dataset.id = it.imdbID;
    li.innerHTML = `<span>${it.title}</span><small>${it.year}</small>`;
    li.onclick = ()=> selectByIndex(i);
    sug.appendChild(li);
  });
  sug.classList.add('show');
  active = -1;
}

async function fetchSuggestions(term){
  const stamp = ++lastFetch;
  const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
  const data = await r.json();
  if (stamp !== lastFetch) return;
  items = data.results || [];
  showSuggestions(items);
}

const onInput = debounce(()=>{
  const term = q.value.trim();
  if (term.length < 2){ showSuggestions([]); return; }
  fetchSuggestions(term);
}, 200);
q.addEventListener('input', onInput);

q.addEventListener('keydown', ev=>{
  if (ev.key === 'Enter'){
    if (sug.classList.contains('show') && active >= 0){
      ev.preventDefault();
      selectByIndex(active);
    } else {
      ev.preventDefault();
      const term = q.value.trim();
      if (term.length >= 2) doSearchByTitle(term);
    }
    return;
  }
  if (!sug.classList.contains('show')) return;
  const max = items.length - 1;
  if (ev.key === 'ArrowDown'){ ev.preventDefault(); active = Math.min(max, active+1); highlight(); }
  if (ev.key === 'ArrowUp'){   ev.preventDefault(); active = Math.max(0, active-1);    highlight(); }
  if (ev.key === 'Escape'){ sug.classList.remove('show'); }
});

function highlight(){ [...sug.children].forEach((li, i)=> li.classList.toggle('active', i===active)); }

async function selectByIndex(i){
  const it = items[i]; if (!it) return;
  q.value = it.title;
  sug.classList.remove('show');
  const r = await fetch(`/api/movie?id=${encodeURIComponent(it.imdbID)}`);
  const data = await r.json();
  renderResult(data);
}

async function doSearchByTitle(term){               // NEW
  const r = await fetch(`/api/movie?title=${encodeURIComponent(term)}`);
  const data = await r.json();
  renderResult(data);
}

searchBtn.onclick = ()=>{
  const term = q.value.trim();
  if (term.length < 2){ q.focus(); return; }
  doSearchByTitle(term);
};

function renderResult(m){
  if (!m || m.error){ result.classList.add('hidden'); return; }
  const actors = Array.isArray(m.actors) ? m.actors : [];
  const actorsHTML = actors.length ? `
    <div style="margin-top:14px">
      <h3 style="margin:0 0 8px;font-size:18px">Top Cast</h3>
      <div class="actors">
        ${actors.map(a => `
          <div class="actor-card">
            <div class="avatar">
              ${a.photo ? `<img src="${a.photo}" alt="${a.name}">` : initials(a.name)}
            </div>
            <div>
              <div class="aname">${a.name}</div>
              <div class="arole">${a.character || 'Actor'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : '';

  result.innerHTML = `
    <div class="poster">${m.poster ? `<img src="${m.poster}" alt="Poster for ${m.title}" style="width:100%;height:100%;object-fit:cover;border-radius:12px"/>` : 'No poster'}</div>
    <div class="info">
      <h2>${m.title}</h2>
      <div class="pill">Year: ${m.year}</div>
      ${m.genre ? `<div class="pill">${m.genre}</div>`:''}
      ${m.rated ? `<div class="pill">Rated: ${m.rated}</div>`:''}
      ${m.runtime ? `<div class="pill">${m.runtime}</div>`:''}
      <div style="margin-top:10px"><a href="https://www.imdb.com/title/${m.imdbID}/" target="_blank" rel="noopener">View on IMDb</a></div>
      ${actorsHTML}
    </div>`;
  result.classList.remove('hidden');
}


clearBtn.onclick = ()=>{ q.value=''; q.focus(); showSuggestions([]); result.classList.add('hidden'); };
