import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SharedMap from './pages/SharedMap';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import SharedReport from './pages/SharedReport';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/map/:token" element={<SharedMap />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/reports/:id" element={<ReportDetail />} />
      <Route path="/report/:token" element={<SharedReport />} />
    </Routes>
  );
}
