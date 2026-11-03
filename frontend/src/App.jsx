import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import Navbar from './components/Navbar';

// Core Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import GlobalAnalytics from './pages/GlobalAnalytics';

// Repository Pages
import RepositoryView from './pages/RepositoryView';
import FileViewer from './pages/FileViewer';
import CommitHistory from './pages/CommitHistory';
import CommitDetail from './pages/CommitDetail';
import CommitExplorer from './pages/CommitExplorer';
import Branches from './pages/Branches';
import PullRequests from './pages/PullRequests';
import PRDetail from './pages/PRDetail';
import Issues from './pages/Issues';
import IssueDetail from './pages/IssueDetail';
import Releases from './pages/Releases';
import Analytics from './pages/Analytics';
import RepoSettings from './pages/RepoSettings';
import RepositoryIntegrity from './pages/RepositoryIntegrity';
import AuditLog from './pages/AuditLog';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
      Loading…
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return children;
};

function App() {
  const { fetchUser, isLoading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
        Loading…
      </div>
    );
  }

  return (
    <Router>
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-base)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            {/* Public / Auth */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* User Level Protected */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />

            {/* Global & Profile */}
            <Route path="/analytics" element={<GlobalAnalytics />} />
            <Route path="/profile/:username" element={<Profile />} />

            {/* Repository Views */}
            <Route path="/:owner/:name" element={<RepositoryView />} />
            <Route path="/:owner/:name/blob/:branch/*" element={<FileViewer />} />
            <Route path="/:owner/:name/commits/:branch" element={<CommitHistory />} />
            <Route path="/:owner/:name/commit/:sha" element={<CommitDetail />} />
            <Route path="/:owner/:name/network" element={<CommitExplorer />} />
            <Route path="/:owner/:name/branches" element={<Branches />} />
            <Route path="/:owner/:name/pulls" element={<PullRequests />} />
            <Route path="/:owner/:name/pulls/:prNumber" element={<PRDetail />} />
            <Route path="/:owner/:name/issues" element={<Issues />} />
            <Route path="/:owner/:name/issues/:issueNumber" element={<IssueDetail />} />
            <Route path="/:owner/:name/releases" element={<Releases />} />
            <Route path="/:owner/:name/analytics" element={<Analytics />} />
            <Route path="/:owner/:name/integrity" element={<RepositoryIntegrity />} />
            <Route path="/:owner/:name/audit" element={<AuditLog />} />
            <Route path="/:owner/:name/settings" element={
              <ProtectedRoute>
                <RepoSettings />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
