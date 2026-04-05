import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram.js';
import { hapticFeedback } from './utils/telegram.js';
import Home from './pages/Home.js';
import Filters from './pages/Filters.js';
import FilterEdit from './pages/FilterEdit.js';
import Feed from './pages/Feed.js';
import Purchases from './pages/Purchases.js';
import PurchaseEdit from './pages/PurchaseEdit.js';
import Analytics from './pages/Analytics.js';
import Settings from './pages/Settings.js';

const NAV_ITEMS = [
  { label: 'Home', icon: '🏠', path: '/' },
  { label: 'Filtres', icon: '🔍', path: '/filters' },
  { label: 'Feed', icon: '📦', path: '/feed' },
  { label: 'Achats', icon: '💰', path: '/purchases' },
  { label: 'Stats', icon: '📊', path: '/analytics' },
];

const MAIN_PATHS = ['/', '/filters', '/feed', '/purchases', '/analytics'];

function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!MAIN_PATHS.includes(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-tg-section border-t border-[var(--card-border)] px-1 z-50"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))', paddingTop: '0.375rem' }}
    >
      <div className="flex justify-around max-w-md mx-auto">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => { hapticFeedback('light'); navigate(item.path); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[48px] ${isActive ? 'bg-tg-secondary' : 'active:bg-tg-secondary'}`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className={`text-[9px] font-medium leading-none mt-0.5 ${isActive ? 'text-tg-accent' : 'text-tg-hint'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/filters" element={<Filters />} />
        <Route path="/filters/new" element={<FilterEdit />} />
        <Route path="/filters/:id" element={<FilterEdit />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchases/new" element={<PurchaseEdit />} />
        <Route path="/purchases/:id" element={<PurchaseEdit />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  const { colorScheme } = useTelegram();

  return (
    <div className={`app ${colorScheme}`}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </div>
  );
}
