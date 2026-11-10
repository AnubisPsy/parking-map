import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PageSkeleton } from './components/ui/Skeleton';

const Home = lazy(() => import('./pages/Home'));
const SharedMap = lazy(() => import('./pages/SharedMap'));
const Tracks = lazy(() => import('./pages/Tracks'));
const Reports = lazy(() => import('./pages/Reports'));
const ReportDetail = lazy(() => import('./pages/ReportDetail'));
const SharedReport = lazy(() => import('./pages/SharedReport'));
const SharedTracks = lazy(() => import('./pages/SharedTracks'));

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map/:token" element={<SharedMap />} />
        <Route path="/recorridos" element={<Tracks />} />
        <Route path="/recorrido/:token" element={<SharedTracks />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
        <Route path="/report/:token" element={<SharedReport />} />
      </Routes>
    </Suspense>
  );
}
