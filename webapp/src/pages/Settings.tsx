import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, Download, Trash2, LogOut, ChevronRight,
} from 'lucide-react';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';
import api from '../api/client.js';

export default function Settings() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState(true);
  const [saving, setSaving] = useState(false);

  const toggleNotifs = async () => {
    hapticFeedback('medium');
    const next = !notifs;
    setNotifs(next);
    try {
      setSaving(true);
      await api.put('/settings', { notification_enabled: next });
      hapticNotification('success');
    } catch {
      setNotifs(!next);
      hapticNotification('error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    hapticFeedback('medium');
    try {
      await api.post('/auth/logout');
    } catch {
      // session may already be expired — proceed anyway
    }
    localStorage.removeItem('session_token');
    localStorage.removeItem('session_expires');
    navigate('/auth');
  };

  const handleDeleteData = () => {
    if (confirm('Supprimer toutes les données ? Cette action est irréversible.')) {
      hapticNotification('warning');
    }
  };

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100vh', paddingBottom: 32 }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--secondary-bg-color)', border: '1px solid var(--card-border)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={17} style={{ color: 'var(--hint-color)' }} />
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-color)' }}>
          Paramètres
        </h1>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* ── Alertes ─────────────────────────────────────────── */}
        <SectionLabel>Alertes</SectionLabel>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
            <IconBox color="rgba(124, 58, 237, 0.12)">
              <Bell size={16} style={{ color: 'var(--button-color)' }} />
            </IconBox>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-color)' }}>
                Notifications
              </div>
              <div style={{ fontSize: 11, color: 'var(--hint-color)', marginTop: 1 }}>
                Articles détectés & pépites
              </div>
            </div>
            <button
              onClick={toggleNotifs}
              disabled={saving}
              style={{
                width: 46, height: 26, borderRadius: 13, border: 'none',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: notifs ? 'var(--success-color)' : 'var(--secondary-bg-color)',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10,
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s',
                transform: notifs ? 'translateX(23px)' : 'translateX(3px)',
              }} />
            </button>
          </div>
        </div>

        {/* ── Données ─────────────────────────────────────────── */}
        <SectionLabel>Données</SectionLabel>
        <div style={cardStyle}>
          <RowButton
            icon={<Download size={16} style={{ color: 'var(--hint-color)' }} />}
            label="Exporter les données"
            sub="Télécharger en CSV"
            onPress={() => hapticFeedback('light')}
            right={<ChevronRight size={14} style={{ color: 'var(--hint-color)' }} />}
          />
          <Separator />
          <RowButton
            icon={<Trash2 size={16} style={{ color: 'var(--destructive-text-color)' }} />}
            label="Supprimer les données"
            sub="Action irréversible"
            onPress={handleDeleteData}
            destructive
          />
        </div>

        {/* ── Compte ──────────────────────────────────────────── */}
        <SectionLabel>Compte</SectionLabel>
        <div style={cardStyle}>
          <RowButton
            icon={<LogOut size={16} style={{ color: 'var(--destructive-text-color)' }} />}
            label="Se déconnecter"
            sub="Revenir à l'écran de connexion"
            onPress={handleLogout}
            destructive
          />
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--hint-color)', marginTop: 32 }}>
          Vinted Bot · v1.0
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: 'var(--section-bg-color)',
  border: '1px solid var(--card-border)',
  borderRadius: 14,
  overflow: 'hidden',
  marginBottom: 20,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
      color: 'var(--hint-color)', padding: '0 4px', marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

function IconBox({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: color, flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function Separator() {
  return <div style={{ height: 1, background: 'var(--card-border)', margin: '0 16px' }} />;
}

function RowButton({
  icon, label, sub, onPress, destructive = false, right,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: destructive ? 'rgba(244, 63, 94, 0.1)' : 'var(--secondary-bg-color)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: destructive ? 'var(--destructive-text-color)' : 'var(--text-color)' }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: 'var(--hint-color)', marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
      {right}
    </button>
  );
}
