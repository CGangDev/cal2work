import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { exec } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Determine if we're running as a packaged executable (pkg sets process.pkg)
const IS_PACKAGED = Boolean(process.pkg);
const PRODUCTION = IS_PACKAGED || process.env.NODE_ENV === 'production';

// Path resolution for the dist/ folder:
// - In pkg: assets are embedded in the snapshot filesystem (/snapshot/...)
//   We use __dirname which points into the snapshot, then resolve dist relative to it.
// - In normal Node.js production mode: dist is next to server.mjs
// - In dev mode: dist is not served (Vite handles it)
let DIST_DIR;
if (IS_PACKAGED) {
  // pkg embeds assets relative to the package.json; __dirname in the CJS bundle
  // points to the snapshot root where server.cjs lives
  DIST_DIR = path.join(__dirname, 'dist');
} else if (import.meta.url) {
  DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
} else if (typeof __dirname !== 'undefined') {
  DIST_DIR = path.join(__dirname, 'dist');
} else {
  DIST_DIR = path.join(process.cwd(), 'dist');
}

// iCloud CalDAV uses caldav.icloud.com and regional variants like p66-caldav.icloud.com
const ALLOWED_CALDAV_HOST = /^(caldav\.icloud\.com|p\d{1,3}-caldav\.icloud\.com)$/;

function isAllowedCalDavUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_CALDAV_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

const PORT = PRODUCTION ? (parseInt(process.env.PORT, 10) || 3000) : 3001;
const CALDAV_BASE = 'https://caldav.icloud.com';

const app = express();

if (PRODUCTION) {
  // In production, frontend is served from the same origin — no CORS needed
  // Serve static frontend files
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
} else {
  // In dev, allow CORS from Vite dev server
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  }));
}

app.use(express.json());

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => ['response', 'propstat'].includes(name),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function basicAuth(email, password) {
  return 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
}

function resolveUrl(href, fallbackBase) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  // iCloud sometimes returns regional hostnames in hrefs (p66-caldav.icloud.com, etc.)
  // Use the fallback base (the URL we last successfully talked to)
  const base = new URL(fallbackBase);
  return `${base.protocol}//${base.host}${href}`;
}

function getText(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object' && '#text' in val) return String(val['#text']);
  return '';
}

// Make a CalDAV request, manually following one redirect so the method is preserved
async function caldavRequest(method, url, body, extraHeaders, auth) {
  const headers = {
    Authorization: auth,
    'Content-Type': 'application/xml; charset=utf-8',
    ...extraHeaders,
  };

  let response = await axios({ method, url, data: body, headers, maxRedirects: 0, validateStatus: () => true });

  if ([301, 302, 307, 308].includes(response.status) && response.headers.location) {
    const redirectUrl = response.headers.location.startsWith('http')
      ? response.headers.location
      : `${new URL(url).origin}${response.headers.location}`;
    if (!isAllowedCalDavUrl(redirectUrl)) {
      throw new Error(`Redirect to disallowed host blocked: ${new URL(redirectUrl).hostname}`);
    }
    response = await axios({ method, url: redirectUrl, data: body, headers, maxRedirects: 0, validateStatus: () => true });
  }

  return response;
}

function propfind(url, body, depth, auth) {
  return caldavRequest('PROPFIND', url, body, { Depth: depth }, auth);
}

function report(url, body, auth) {
  return caldavRequest('REPORT', url, body, { Depth: '1' }, auth);
}

// ── CalDAV discovery ────────────────────────────────────────────────────────

async function discoverCalendarHome(email, password) {
  const auth = basicAuth(email, password);

  // Step 1: Discover principal URL via well-known
  const principalResp = await propfind(
    `${CALDAV_BASE}/.well-known/caldav`,
    `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:current-user-principal/></D:prop>
</D:propfind>`,
    '0',
    auth,
  );

  if (principalResp.status === 401) throw Object.assign(new Error('Unauthorized'), { code: 401 });
  if (principalResp.status !== 207) throw new Error(`Unexpected status from iCloud: ${principalResp.status}`);

  const principalXml = xmlParser.parse(principalResp.data);
  const principalHref = findHrefInProp(principalXml, 'current-user-principal');
  if (!principalHref) throw new Error('Could not find principal URL in iCloud response');

  const principalUrl = resolveUrl(principalHref, CALDAV_BASE);

  // Step 2: Get calendar-home-set from principal
  const homeResp = await propfind(
    principalUrl,
    `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/></D:prop>
</D:propfind>`,
    '0',
    auth,
  );

  if (homeResp.status !== 207) throw new Error(`Unexpected status fetching calendar home: ${homeResp.status}`);

  const homeXml = xmlParser.parse(homeResp.data);
  const homeHref = findHrefInProp(homeXml, 'calendar-home-set');
  if (!homeHref) throw new Error('Could not find calendar home in iCloud response');

  return { auth, calendarHomeUrl: resolveUrl(homeHref, principalUrl) };
}

// Walk the 207 multistatus XML and find href nested inside a named property
function findHrefInProp(xml, propName) {
  const responses = xml?.multistatus?.response ?? [];
  for (const r of responses) {
    for (const ps of r?.propstat ?? []) {
      const href = ps?.prop?.[propName]?.href;
      if (href) return getText(href);
    }
  }
  return null;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// List the user's calendars
app.post('/api/icloud/calendars', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    const { auth, calendarHomeUrl } = await discoverCalendarHome(email, password);

    const listResp = await propfind(
      calendarHomeUrl,
      `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>`,
      '1',
      auth,
    );

    if (listResp.status !== 207) {
      return res.status(502).json({ error: `Unexpected status listing calendars: ${listResp.status}` });
    }

    const listXml = xmlParser.parse(listResp.data);
    const calendars = [];

    for (const r of listXml?.multistatus?.response ?? []) {
      const href = getText(r?.href);
      for (const ps of r?.propstat ?? []) {
        const resourcetype = ps?.prop?.resourcetype;
        // A calendar resource has <C:calendar/> inside resourcetype
        const isCalendar = resourcetype && 'calendar' in resourcetype;
        if (!isCalendar) continue;

        const displayname = getText(ps?.prop?.displayname);
        if (!displayname) continue;

        // Confirm it supports VEVENT (skip task-only calendars)
        const compSet = ps?.prop?.['supported-calendar-component-set'];
        const supportsVEvent = !compSet || JSON.stringify(compSet).toLowerCase().includes('vevent');
        if (!supportsVEvent) continue;

        calendars.push({ url: resolveUrl(href, calendarHomeUrl), name: displayname });
      }
    }

    res.json({ calendars });
  } catch (err) {
    const status = err.code === 401 ? 401 : 500;
    const message = err.code === 401
      ? 'Invalid Apple ID or app-specific password.'
      : 'Failed to connect to iCloud. Check credentials and try again.';
    console.error('[/api/icloud/calendars]', err.message);
    res.status(status).json({ error: message });
  }
});

// Fetch all events from selected calendars
app.post('/api/icloud/events', async (req, res) => {
  const { email, password, calendarUrls } = req.body ?? {};
  if (!email || !password || !Array.isArray(calendarUrls) || calendarUrls.length === 0) {
    return res.status(400).json({ error: 'email, password, and calendarUrls are required' });
  }

  const invalidUrl = calendarUrls.find((u) => !isAllowedCalDavUrl(u));
  if (invalidUrl) {
    return res.status(400).json({ error: 'One or more calendar URLs are not valid iCloud CalDAV addresses.' });
  }

  const auth = basicAuth(email, password);
  const icsBlocks = [];

  try {
    for (const calUrl of calendarUrls) {
      const resp = await report(
        calUrl,
        `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`,
        auth,
      );

      if (resp.status !== 207) {
        console.warn(`[events] Skipping ${calUrl} — status ${resp.status}`);
        continue;
      }

      const xml = xmlParser.parse(resp.data);
      for (const r of xml?.multistatus?.response ?? []) {
        for (const ps of r?.propstat ?? []) {
          const calData = ps?.prop?.['calendar-data'];
          const text = getText(calData);
          if (text.includes('BEGIN:VCALENDAR')) icsBlocks.push(text.trim());
        }
      }
    }

    res.json({ icsBlocks });
  } catch (err) {
    console.error('[/api/icloud/events]', err.message);
    res.status(500).json({ error: 'Failed to fetch events from iCloud.' });
  }
});

// Fetch a Google Calendar private iCal feed
function isAllowedGoogleIcalUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'calendar.google.com' &&
      parsed.pathname.startsWith('/calendar/ical/')
    );
  } catch {
    return false;
  }
}

app.post('/api/google/ical', async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  if (!isAllowedGoogleIcalUrl(url)) {
    return res.status(400).json({
      error: 'URL must be a Google Calendar iCal address (calendar.google.com/calendar/ical/…)',
    });
  }

  try {
    const response = await axios.get(url, {
      maxRedirects: 3,
      validateStatus: (s) => s < 500,
      responseType: 'text',
    });

    if (response.status === 404) {
      return res.status(400).json({ error: 'Calendar not found. Check the URL and try again.' });
    }
    if (response.status !== 200) {
      return res.status(502).json({ error: `Google Calendar returned status ${response.status}` });
    }
    if (!String(response.data).includes('BEGIN:VCALENDAR')) {
      return res.status(502).json({ error: 'Response does not appear to be a valid iCal file.' });
    }

    res.json({ icsText: response.data });
  } catch (err) {
    console.error('[/api/google/ical]', err.message);
    res.status(500).json({ error: 'Failed to fetch Google Calendar. Check the URL and try again.' });
  }
});

// Shut down the app
app.post('/api/shutdown', (_req, res) => {
  res.json({ ok: true });
  if (PRODUCTION) {
    // In production mode, just exit — we are the only process
    setTimeout(() => process.exit(0), 200);
  } else {
    // In dev mode, also kill Vite dev server ports
    let cmd;
    if (process.platform === 'win32') {
      const ps = [5173, 5174, 5175].map((p) =>
        `$p = (Get-NetTCPConnection -LocalPort ${p} -ErrorAction SilentlyContinue).OwningProcess; if ($p) { $p | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }`
      ).join('; ');
      cmd = `powershell -NoProfile -Command "${ps}"`;
    } else {
      cmd = 'fuser -k 5173/tcp 5174/tcp 5175/tcp 2>/dev/null; lsof -ti:5173,5174,5175 | xargs kill -9 2>/dev/null; true';
    }
    exec(cmd, () => process.exit(0));
  }
});

// In production, serve the SPA — any non-API route returns index.html
if (PRODUCTION) {
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// ── Start server & open browser ─────────────────────────────────────────────

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null`;
  exec(cmd, () => {});
}

function startServer(port, maxAttempts = 10) {
  const server = app.listen(port);

  server.on('listening', () => {
    const url = `http://localhost:${port}`;
    if (PRODUCTION) {
      console.log(`Cal2Work → ${url}`);
      console.log('Press Ctrl+C to stop.');
      openBrowser(url);
    } else {
      console.log(`iCloud CalDAV proxy → ${url}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1, maxAttempts - 1);
    } else {
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
  });
}

startServer(PORT);
