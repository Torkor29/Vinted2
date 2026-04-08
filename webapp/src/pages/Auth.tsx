import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg('Lien invalide. Utilise /login dans le bot Telegram.');
      return;
    }

    axios.post(`${baseURL}/auth/exchange`, { token })
      .then(res => {
        if (res.data?.sessionToken) {
          localStorage.setItem('session_token', res.data.sessionToken);
          localStorage.setItem('session_expires', res.data.expiresAt);
          setStatus('success');
          setTimeout(() => navigate('/'), 1200);
        } else {
          throw new Error('No session token');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Lien expiré ou déjà utilisé. Tape /login dans le bot pour en obtenir un nouveau.');
      });
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--bg-color)' }}
    >
      {status === 'loading' && (
        <>
          <div
            className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mb-6"
            style={{ borderColor: 'var(--button-color)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--hint-color)' }}>
            Connexion en cours…
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(0, 214, 143, 0.12)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-color)' }}>
            Connecté !
          </p>
          <p className="text-sm" style={{ color: 'var(--hint-color)' }}>
            Redirection…
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(229, 87, 87, 0.12)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--destructive-text-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
            Lien invalide
          </p>
          <p className="text-sm text-center" style={{ color: 'var(--hint-color)' }}>
            {errorMsg}
          </p>
        </>
      )}
    </div>
  );
}
