/**
 * Diagnostic endpoint — call from browser to check:
 *   1. Is this Vercel function reachable?
 *   2. Can it reach the VPS backend on port 3000?
 */
export default async function handler(req, res) {
  const VPS = 'http://164.68.127.76:3000';
  let vpsStatus = 'unreachable';
  let vpsError = null;

  try {
    const r = await fetch(`${VPS}/health`, { signal: AbortSignal.timeout(5000) });
    const body = await r.json();
    vpsStatus = body?.status === 'ok' ? 'ok' : `unexpected: ${JSON.stringify(body)}`;
  } catch (err) {
    vpsError = err?.message ?? String(err);
  }

  res.json({
    vercelFunction: 'ok',
    vpsReachable: vpsStatus === 'ok',
    vpsStatus,
    vpsError,
    timestamp: new Date().toISOString(),
  });
}
