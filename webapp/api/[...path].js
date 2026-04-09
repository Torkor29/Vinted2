/**
 * Vercel serverless proxy — routes all /api/* calls to the VPS backend.
 * Runs server-side on Vercel, so HTTP→HTTP is fine (no browser mixed-content restriction).
 */
const BACKEND_URL = 'http://164.68.127.76:3000';

export default async function handler(req, res) {
  const target = `${BACKEND_URL}${req.url}`;

  try {
    const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '');

    const response = await fetch(target, {
      method: req.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization
          ? { authorization: req.headers.authorization }
          : {}),
      },
      body: hasBody && req.body ? JSON.stringify(req.body) : undefined,
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
