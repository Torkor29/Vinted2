import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ShoppingBag, CheckCircle2, XCircle } from 'lucide-react';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

type Status = 'loading' | 'success' | 'error';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Already logged in → go home
    const existing = localStorage.getItem('session_token');
    if (existing) {
      navigate('/');
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg('Lien incomplet — aucun token détecté.\nTape /login dans le bot Telegram pour recevoir un nouveau lien.');
      return;
    }

    axios
      .post(`${baseURL}/auth/exchange`, { token }, { timeout: 10000 })
      .then((res) => {
        if (res.data?.sessionToken) {
          localStorage.setItem('session_token', res.data.sessionToken);
          localStorage.setItem('session_expires', res.data.expiresAt ?? '');
          setStatus('success');
          setTimeout(() => navigate('/'), 1400);
        } else {
          throw new Error('no token in response');
        }
      })
      .catch((err) => {
        const is401 = err?.response?.status === 401;
        setStatus('error');
        setErrorMsg(
          is401
            ? 'Lien expiré ou déjà utilisé.\nTape /login dans le bot pour en obtenir un nouveau (valide 10 min).'
            : 'Impossible de joindre le serveur.\nVérifie ta connexion puis retente /login dans le bot.',
        );
      });
  }, []);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-color)',
        padding: '32px 24px',
      }}
    >
      {/* ── Brand ───────────────────────────────────────────────── */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: 'linear-gradient(145deg, #7c3aed 0%, #5b21b6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          boxShadow: '0 8px 32px rgba(124, 58, 237, 0.4)',
        }}
      >
        <ShoppingBag size={34} color="#fff" strokeWidth={1.8} />
      </div>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text-color)',
          letterSpacing: '-0.5px',
          marginBottom: 5,
        }}
      >
        Vinted Bot
      </h1>
      <p
        style={{
          fontSize: 13,
          color: 'var(--hint-color)',
          marginBottom: 52,
        }}
      >
        Surveillance en temps réel
      </p>

      {/* ── Status ──────────────────────────────────────────────── */}
      {status === 'loading' && (
        <div
          className="anim-fade-in"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
        >
          <div
            className="anim-spin"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '3px solid var(--secondary-bg-color)',
              borderTopColor: 'var(--button-color)',
            }}
          />
          <p style={{ fontSize: 14, color: 'var(--hint-color)', fontWeight: 500 }}>
            Connexion en cours…
          </p>
        </div>
      )}

      {status === 'success' && (
        <div
          className="anim-scale-in"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={32} color="var(--success-color)" strokeWidth={2} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-color)', marginBottom: 5 }}>
              Connecté !
            </p>
            <p style={{ fontSize: 13, color: 'var(--hint-color)' }}>
              Redirection en cours…
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div
          className="anim-scale-in"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 300 }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XCircle size={32} color="var(--destructive-text-color)" strokeWidth={2} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-color)', marginBottom: 8 }}>
              Échec de la connexion
            </p>
            <p
              style={{
                fontSize: 13,
                color: 'var(--hint-color)',
                lineHeight: 1.65,
                whiteSpace: 'pre-line',
              }}
            >
              {errorMsg}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
