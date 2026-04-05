import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '../hooks/useTelegram.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';
import api from '../api/client.js';

export default function Settings() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(handleBack);

  const toggleNotifs = async () => {
    hapticFeedback('medium');
    const v = !notifs;
    setNotifs(v);
    try {
      setSaving(true);
      await api.put('/settings', { notification_enabled: v });
      hapticNotification('success');
    } catch { setNotifs(!v); hapticNotification('error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">
      <h1 className="text-lg font-bold text-tg mb-4">⚙️ Parametres</h1>

      <div className="bg-tg-section rounded-xl border border-[var(--card-border)] overflow-hidden mb-3">
        <div className="flex items-center justify-between p-3">
          <div>
            <div className="text-sm text-tg">Notifications</div>
            <div className="text-[10px] text-tg-hint">Alertes articles & pepites</div>
          </div>
          <button onClick={toggleNotifs} disabled={saving}
            className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ${notifs ? 'bg-[var(--success-color)]' : 'bg-gray-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifs ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="bg-tg-section rounded-xl border border-[var(--card-border)] overflow-hidden mb-3">
        <button onClick={() => { hapticFeedback('light'); }}
          className="w-full flex items-center justify-between p-3 active:bg-tg-secondary">
          <div>
            <div className="text-sm text-tg">Exporter les donnees</div>
            <div className="text-[10px] text-tg-hint">Telecharger en CSV</div>
          </div>
          <span className="text-tg-hint text-xs">▶</span>
        </button>
      </div>

      <div className="bg-tg-section rounded-xl border border-[var(--card-border)] overflow-hidden">
        <button onClick={() => { if (confirm('Supprimer toutes les donnees ?')) hapticNotification('warning'); }}
          className="w-full p-3 text-left active:bg-tg-secondary">
          <div className="text-sm text-tg-destructive">Supprimer les donnees</div>
          <div className="text-[10px] text-tg-hint">Action irreversible</div>
        </button>
      </div>

      <div className="text-center text-[10px] text-tg-hint mt-8">Vinted Bot v1.0.0</div>
    </div>
  );
}
