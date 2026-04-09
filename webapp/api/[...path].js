/**
 * Vercel serverless proxy — routes all /api/* calls to the VPS backend.
 * Runs server-side on Vercel, so HTTP→HTTP is fine (no browser mixed-content restriction).
 */
const BACKEND_URL = 'http://164.68.127.76:3000';

/** Read raw body from request stream (fallback when Vercel doesn't auto-parse) */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const target = `${BACKEND_URL}${req.url}`;

  try {
    const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '');

    let bodyString;
    if (hasBody) {
      if (req.body !== undefined && req.body !== null) {
        // Vercel already parsed the JSON body
        bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      } else {
        // Read raw stream as fallback
        bodyString = await readBody(req);
      }
    }

    const response = await fetch(target, {
      method: req.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization
          ? { authorization: req.headers.authorization }
          : {}),
      },
      body: hasBody && bodyString ? bodyString : undefined,
    });

    let data;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({
      success: false,
      error: 'backend_unavailable',
      message: err?.message ?? 'VPS backend is unreachable',
    });
  }
}
