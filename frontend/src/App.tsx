import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/layout/Layout';
import ToastProvider from './components/ui/Toast';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import ReviewApprovePage from './pages/ReviewApprovePage';
import SimulationEditorPage from './pages/SimulationEditorPage';
import SimulationWorkspace from './pages/SimulationWorkspace';
import ResultsPage from './pages/ResultsPage';
import ComparePage from './pages/ComparePage';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:id/upload" element={<DocumentUploadPage />} />
          <Route path="/simulations/:id/review" element={<ReviewApprovePage />} />
          <Route path="/simulations/:id/edit" element={<SimulationEditorPage />} />
          <Route path="/simulations/:id/workspace" element={<SimulationWorkspace />} />
          <Route path="/simulations/:id/results" element={<ResultsPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
