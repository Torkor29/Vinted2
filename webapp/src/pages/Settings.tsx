import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Power,
  Users,
  Zap,
  MessageCircle,
  Info,
  ExternalLink,
  Shield,
} from 'lucide-react'
import PageTransition from '../components/PageTransition'
import { useBotStatus, useBotStart, useBotStop } from '../hooks/useBotStatus'
import { useSessions } from '../hooks/useStats'

export default function Settings() {
  const navigate = useNavigate()
  const { data: status } = useBotStatus()
  const { data: sessions } = useSessions()
  const startBot = useBotStart()
  const stopBot = useBotStop()

  const running = status?.running ?? false

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/')}
          className="btn-press w-10 h-10 rounded-xl bg-bg-card glass-border flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-white">Réglages</h1>
      </div>

      <div className="flex flex-col gap-3">
        {/* Bot Control */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Power size={18} className="text-accent-light" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Contrôle du bot</h3>
              <p className="text-2xs text-gray-500">Démarrer ou arrêter la détection</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  running ? 'bg-success animate-pulse-live' : 'bg-gray-600'
                }`}
              />
              <span className="text-sm text-gray-300 font-medium">
                {running ? 'Bot actif' : 'Bot arrêté'}
              </span>
            </div>
            <button
              onClick={() => (running ? stopBot.mutate() : startBot.mutate())}
              disabled={startBot.isPending || stopBot.isPending}
              className={`btn-press px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                running
                  ? 'bg-danger/15 text-danger'
                  : 'gradient-purple text-white shadow-sm shadow-accent/20'
              }`}
            >
              {running ? 'Arrêter' : 'Démarrer'}
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Users size={18} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Sessions</h3>
              <p className="text-2xs text-gray-500">Pool de connexions actives</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{sessions?.active ?? 0}</p>
              <p className="text-2xs text-gray-500">/ {sessions?.total ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Turbo Mode */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center">
              <Zap size={18} className="text-gold" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Mode Turbo</h3>
              <p className="text-2xs text-gray-500">Rafraîchissement accéléré</p>
            </div>
            <button
              className="btn-press w-12 h-7 rounded-full bg-bg-secondary glass-border relative transition-all"
              onClick={() => {}}
            >
              <div className="w-5 h-5 rounded-full bg-gray-500 absolute left-1 top-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Telegram */}
        <a
          href="https://t.me/lesbonnesaffaires_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-card p-4 btn-press block"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
              <MessageCircle size={18} className="text-sky-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Telegram</h3>
              <p className="text-2xs text-gray-500">Rejoindre le groupe</p>
            </div>
            <ExternalLink size={15} className="text-gray-500" />
          </div>
        </a>

        {/* API Key */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Shield size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Clé API</h3>
              <p className="text-2xs text-gray-500">Authentification backend</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="Entrer la clé API..."
            defaultValue={localStorage.getItem('api_key') || ''}
            onChange={(e) => {
              if (e.target.value) {
                localStorage.setItem('api_key', e.target.value)
              } else {
                localStorage.removeItem('api_key')
              }
            }}
            className="w-full px-3 py-2.5 bg-bg-secondary rounded-xl glass-border text-sm text-white placeholder:text-gray-500 outline-none focus:border-accent/30 transition-colors font-mono text-xs"
          />
        </div>

        {/* App Info */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-500/15 flex items-center justify-center">
              <Info size={18} className="text-gray-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Vinted Sniper</h3>
              <p className="text-2xs text-gray-500">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
