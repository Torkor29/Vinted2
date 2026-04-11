import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Filters from './pages/Filters'
import FilterEdit from './pages/FilterEdit'
import Feed from './pages/Feed'
import Pepites from './pages/Pepites'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen min-h-[100dvh]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/filters" element={<Filters />} />
          <Route path="/filters/new" element={<FilterEdit />} />
          <Route path="/filters/:index" element={<FilterEdit />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/pepites" element={<Pepites />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
