const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const PORT = 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, '..', 'data');
const MISSION_NOTES_DIR = (() => {
  const fsSync = require('fs');
  const candidates = [
    path.join(__dirname, '..', 'missionNotes'),
    path.join(process.cwd(), 'missionNotes'),
    path.join(process.cwd(), '..', 'missionNotes')
  ];
  for (const p of candidates) {
    if (fsSync.existsSync(p)) return path.resolve(p);
  }
  return path.resolve(__dirname, '..', 'missionNotes');
})();
const STATUSES_PATH = path.join(DATA_DIR, 'statuses.json');
const ARC_REF_PATH = path.join(DATA_DIR, 'arc-reference.json');
const ITEMS_PATH = path.join(DATA_DIR, 'items.json');
const MISSIONS_PATH = path.join(DATA_DIR, 'mission.json');
const IN_MAIL_PATH = path.join(DATA_DIR, 'inMail.json');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };

const server = http.createServer(async (req, res) => {
  const base = `http://${req.headers.host || 'localhost:' + PORT}`;
  const url = new URL(req.url || '/', base);
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (pathname.startsWith('/api') && pathname.endsWith('/')) pathname = pathname.slice(0, -1) || '/api';

  if (req.method === 'OPTIONS' && pathname.startsWith('/api')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (pathname === '/api/statuses' && req.method === 'GET') {
    try {
      const data = await fs.readFile(STATUSES_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/arc-reference' && req.method === 'GET') {
    try {
      const data = await fs.readFile(ARC_REF_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/items' && req.method === 'GET') {
    try {
      const data = await fs.readFile(ITEMS_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ items: [] }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (pathname === '/api/statuses' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      if (!body || !body.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Request body is required' }));
        return;
      }
      const json = JSON.parse(body);
      if (typeof json !== 'object' || json === null) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Invalid JSON structure' }));
        return;
      }
      await fs.writeFile(STATUSES_PATH, JSON.stringify(json, null, 2), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/in-mail' && req.method === 'GET') {
    try {
      const data = await fs.readFile(IN_MAIL_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ email: null }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (pathname === '/api/in-mail' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const json = body && body.trim() ? JSON.parse(body) : { email: null };
      if (typeof json !== 'object' || json === null) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const out = { email: json.email ?? null };
      await fs.writeFile(IN_MAIL_PATH, JSON.stringify(out, null, 2), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/mission-notes' && req.method === 'GET') {
    try {
      const files = await fs.readdir(MISSION_NOTES_DIR);
      const notes = files
        .filter(f => f.endsWith('.md'))
        .map(f => ({ name: f.replace(/\.md$/, ''), slug: encodeURIComponent(f.replace(/\.md$/, '')) }));
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ notes }));
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ notes: [] }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (pathname.startsWith('/api/mission-notes/') && req.method === 'GET') {
    const slug = pathname.replace(/^\/api\/mission-notes\//, '');
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: 'Missing filename' }));
      return;
    }
    try {
      const name = decodeURIComponent(slug);
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Invalid filename' }));
        return;
      }
      const filename = name + '.md';
      const filePath = path.resolve(MISSION_NOTES_DIR, filename);
      if (!filePath.startsWith(path.resolve(MISSION_NOTES_DIR))) {
        res.writeHead(403, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }
      const content = await fs.readFile(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', ...CORS });
      res.end(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Mission note not found' }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (pathname === '/api/missions' && req.method === 'GET') {
    try {
      const data = await fs.readFile(MISSIONS_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ missions: [] }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  if (pathname === '/api/missions' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Request body is required' }));
        return;
      }
      const mission = JSON.parse(body);
      let data = { missions: [] };
      try {
        const raw = await fs.readFile(MISSIONS_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.missions === 'object') data = parsed;
      } catch (e) {
        if (e.code !== 'ENOENT') {
          data = { missions: [] };
        }
      }
      data.missions = Array.isArray(data.missions) ? data.missions : [];
      const id = 'mission-' + Date.now();
      const newMission = {
        id,
        date: new Date().toISOString().slice(0, 10),
        异常状态: mission.异常状态 || '',
        代号: mission.代号 || '',
        行为: mission.行为 || '',
        焦点: mission.焦点 || '',
        领域: mission.领域 || '',
        参与者: mission.参与者 || '',
        察看期: mission.察看期 || '',
        MVP: mission.MVP || '',
        最终评级: mission.最终评级 || ''
      };
      data.missions.unshift(newMission);
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(MISSIONS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ ok: true, mission: newMission }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/missions' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const json = body && body.trim() ? JSON.parse(body) : { missions: [] };
      if (typeof json !== 'object' || json === null || !Array.isArray(json.missions)) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Body must be { missions: array }' }));
        return;
      }
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(MISSIONS_PATH, JSON.stringify({ missions: json.missions }, null, 2), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/items' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (!body || !body.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'Request body is required' }));
        return;
      }
      const item = JSON.parse(body);
      const name = (item.name || '').trim();
      if (!name) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS });
        res.end(JSON.stringify({ error: 'name is required' }));
        return;
      }
      let data = { items: [] };
      try {
        const raw = await fs.readFile(ITEMS_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.items === 'object') data = parsed;
      } catch (e) {
        if (e.code !== 'ENOENT') data = { items: [] };
      }
      data.items = Array.isArray(data.items) ? data.items : [];
      const newItem = {
        id: name,
        name,
        price: typeof item.price === 'number' ? item.price : (parseInt(item.price, 10) || 0),
        description: (item.description || '').trim()
      };
      data.items.push(newItem);
      await fs.writeFile(ITEMS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ ok: true, item: newItem }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify({ error: 'API not found: ' + pathname }));
    return;
  }

  const filePath = path.resolve(PUBLIC_DIR, pathname.slice(1));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  const ext = path.extname(filePath);
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`GM Editor running at http://localhost:${PORT}`);
  console.log(`Mission notes from: ${MISSION_NOTES_DIR}`);
});
