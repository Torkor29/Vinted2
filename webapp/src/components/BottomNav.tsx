import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Search, Radio, Gem, BarChart3 } from 'lucide-react'

const tabs = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/filters', icon: Search, label: 'Filtres' },
  { path: '/feed', icon: Radio, label: 'Feed' },
  { path: '/pepites', icon: Gem, label: 'Pépites' },
  { path: '/analytics', icon: BarChart3, label: 'Stats' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-bg-card/95 backdrop-blur-xl border-t border-glass z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[56px] relative">
        {tabs.map((tab) => {
          const active = isActive(tab.path)
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="btn-press flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-accent" />
              )}
              <Icon
                size={20}
                className={active ? 'text-accent' : 'text-gray-500'}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {active && (
                <span className="text-[10px] font-semibold text-accent leading-none mt-0.5">
                  {tab.label}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
