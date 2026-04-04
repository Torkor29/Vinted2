import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '../hooks/useTelegram.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';
import api from '../api/client.js';

export default function Settings() {
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(handleBack);

  const toggleNotifications = async () => {
    hapticFeedback('medium');
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);

    try {
      setSaving(true);
      await api.put('/settings', { notification_enabled: newValue });
      hapticNotification('success');
    } catch {
      setNotificationsEnabled(!newValue); // revert
      hapticNotification('error');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    hapticFeedback('medium');
    try {
      const { data } = await api.get('/purchases?format=csv', { responseType: 'blob' });
      hapticNotification('success');
    } catch {
      hapticNotification('error');
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold text-tg mb-4">Parametres</h1>

      <div className="bg-tg-section rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
        {/* Notifications */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium text-tg">Notifications</div>
            <div className="text-xs text-tg-hint">Recevoir les alertes d'articles</div>
          </div>
          <button
            onClick={toggleNotifications}
            disabled={saving}
            className={`w-12 h-7 rounded-full relative transition-colors ${
              notificationsEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </div>

      <div className="bg-tg-section rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
        {/* Export */}
        <button
          onClick={exportData}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div>
            <div className="text-sm font-medium text-tg">Exporter les donnees</div>
            <div className="text-xs text-tg-hint">Telecharger tes achats en CSV</div>
          </div>
          <span className="text-tg-hint">{'>'}</span>
        </button>
      </div>

      <div className="bg-tg-section rounded-xl">
        <button
          onClick={() => {
            if (confirm('Supprimer toutes tes donnees ? Cette action est irreversible.')) {
              hapticNotification('warning');
            }
          }}
          className="w-full p-4 text-left"
        >
          <div className="text-sm font-medium text-tg-destructive">Supprimer toutes les donnees</div>
          <div className="text-xs text-tg-hint">Cette action est irreversible</div>
        </button>
      </div>

      <div className="text-center text-xs text-tg-hint mt-8">
        Vinted Bot v1.0.0
      </div>
    </div>
  );
}
