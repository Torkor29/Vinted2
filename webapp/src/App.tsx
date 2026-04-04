import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram.js';
import Home from './pages/Home.js';
import Filters from './pages/Filters.js';
import FilterEdit from './pages/FilterEdit.js';
import Feed from './pages/Feed.js';
import Purchases from './pages/Purchases.js';
import PurchaseEdit from './pages/PurchaseEdit.js';
import Analytics from './pages/Analytics.js';
import Settings from './pages/Settings.js';

export default function App() {
  const { colorScheme } = useTelegram();

  return (
    <div className={`app ${colorScheme}`}>
      <BrowserRouter>
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
      </BrowserRouter>
    </div>
  );
}
