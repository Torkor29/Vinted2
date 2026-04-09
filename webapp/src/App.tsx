import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Home, SlidersHorizontal, Package, ShoppingBag, BarChart3 } from 'lucide-react';
import { hapticFeedback } from './utils/telegram.js';
import Auth from './pages/Auth.js';
import HomePage from './pages/Home.js';
import Filters from './pages/Filters.js';
import FilterEdit from './pages/FilterEdit.js';
import Feed from './pages/Feed.js';
import Purchases from './pages/Purchases.js';
import PurchaseEdit from './pages/PurchaseEdit.js';
import Analytics from './pages/Analytics.js';
import Settings from './pages/Settings.js';

const NAV_ITEMS = [
  { label: 'Home',    Icon: Home,              path: '/' },
  { label: 'Filtres', Icon: SlidersHorizontal, path: '/filters' },
  { label: 'Feed',    Icon: Package,           path: '/feed' },
  { label: 'Achats',  Icon: ShoppingBag,       path: '/purchases' },
  { label: 'Stats',   Icon: BarChart3,         path: '/analytics' },
];

const MAIN_PATHS = ['/', '/filters', '/feed', '/purchases', '/analytics'];

function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!MAIN_PATHS.includes(pathname)) return null;

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'var(--section-bg-color)',
        borderTop: '1px solid var(--card-border)',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        paddingTop: '6px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-around', maxWidth: 480, margin: '0 auto' }}>
        {NAV_ITEMS.map(({ label, Icon, path }) => {
          const isActive = pathname === path;
          return (
            <button
              key={path}
              onClick={() => { hapticFeedback('light'); navigate(path); }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 10px 2px',
                minWidth: 52,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 2,
                    borderRadius: '0 0 2px 2px',
                    backgroundColor: 'var(--button-color)',
                  }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.6}
                style={{
                  color: isActive ? 'var(--button-color)' : 'var(--hint-color)',
                  transition: 'color 0.15s',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--button-color)' : 'var(--hint-color)',
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
              >
                {label}
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
        <Route path="/auth"          element={<Auth />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <div className="app dark">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </div>
  );
}
