import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Home, SlidersHorizontal, Package, ShoppingBag, BarChart3 } from 'lucide-react';
import { useTelegram } from './hooks/useTelegram.js';
import { hapticFeedback } from './utils/telegram.js';
import HomePage from './pages/Home.js';
import Filters from './pages/Filters.js';
import FilterEdit from './pages/FilterEdit.js';
import Feed from './pages/Feed.js';
import Purchases from './pages/Purchases.js';
import PurchaseEdit from './pages/PurchaseEdit.js';
import Analytics from './pages/Analytics.js';
import Settings from './pages/Settings.js';

const NAV_ITEMS = [
  { label: 'Home',     Icon: Home,             path: '/' },
  { label: 'Filtres',  Icon: SlidersHorizontal, path: '/filters' },
  { label: 'Feed',     Icon: Package,           path: '/feed' },
  { label: 'Achats',   Icon: ShoppingBag,       path: '/purchases' },
  { label: 'Stats',    Icon: BarChart3,         path: '/analytics' },
];

const MAIN_PATHS = ['/', '/filters', '/feed', '/purchases', '/analytics'];

function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!MAIN_PATHS.includes(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        backgroundColor: 'var(--section-bg-color)',
        borderTop: '1px solid var(--card-border)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingTop: '0.5rem',
      }}
    >
      <div className="flex justify-around max-w-md mx-auto">
        {NAV_ITEMS.map(({ label, Icon, path }) => {
          const isActive = pathname === path;
          return (
            <button
              key={path}
              onClick={() => { hapticFeedback('light'); navigate(path); }}
              className="flex flex-col items-center gap-1 px-3 py-1 min-w-[48px] relative"
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{ color: isActive ? 'var(--button-color)' : 'var(--hint-color)' }}
              />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--button-color)' : 'var(--hint-color)',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
              {isActive && (
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: 'var(--button-color)' }}
                />
              )}
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
        <Route path="/"              element={<HomePage />} />
        <Route path="/filters"       element={<Filters />} />
        <Route path="/filters/new"   element={<FilterEdit />} />
        <Route path="/filters/:id"   element={<FilterEdit />} />
        <Route path="/feed"          element={<Feed />} />
        <Route path="/purchases"     element={<Purchases />} />
        <Route path="/purchases/new" element={<PurchaseEdit />} />
        <Route path="/purchases/:id" element={<PurchaseEdit />} />
        <Route path="/analytics"     element={<Analytics />} />
        <Route path="/settings"      element={<Settings />} />
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
