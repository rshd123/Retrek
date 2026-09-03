import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardHome from './DashboardHome';
import ROIMetrics from './ROIMetrics';
import TransactionsPage from './TransactionsPage';
import AuditTrail from './AuditTrail';
import BenchmarkPage from './BenchmarkPage';
import SystemHealth from './SystemHealth';
import IngestPage from './IngestPage';
import RecoveryTracker from './RecoveryTracker';

const SIDEBAR_ITEMS = [
  { key: 'home', label: 'Dashboard', path: '/dashboard', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )},
  { key: 'roi', label: 'ROI & Metrics', path: '/dashboard/roi', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )},
  { key: 'transactions', label: 'Transactions', path: '/dashboard/transactions', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )},
  { key: 'audit', label: 'Audit Trail', path: '/dashboard/audit', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )},
  { key: 'benchmark', label: 'Benchmark', path: '/dashboard/benchmark', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )},
  { key: 'system', label: 'System Health', path: '/dashboard/system', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  )},
  { key: 'ingest', label: 'Ingest', path: '/dashboard/ingest', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )},
  { key: 'tracker', label: 'Recovery Tracker', path: '/dashboard/tracker', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )},
];

function getActiveKey(path) {
  if (path === '/dashboard') return 'home';
  const segment = path.replace('/dashboard/', '');
  const match = SIDEBAR_ITEMS.find((item) => item.key === segment);
  return match ? match.key : 'home';
}

export default function Dashboard({ navigate, currentPath }) {
  const { user, logout } = useAuth();
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeKey = getActiveKey(currentPath || '/dashboard');

  const handleNav = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const pages = [
    { key: 'home', component: <DashboardHome navigate={navigate} /> },
    { key: 'roi', component: <ROIMetrics /> },
    { key: 'transactions', component: <TransactionsPage /> },
    { key: 'audit', component: <AuditTrail /> },
    { key: 'benchmark', component: <BenchmarkPage /> },
    { key: 'system', component: <SystemHealth /> },
    { key: 'ingest', component: <IngestPage /> },
    { key: 'tracker', component: <RecoveryTracker /> },
  ];

  return (
    <div className="dashboard-layout">
      {/* Top Navigation */}
      <header className="dashboard-header">
        <div className="header-left">
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? 'is-open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate('/'); }}
            className="dashboard-brand"
          >
            Retrek
          </a>
        </div>

        <div className="header-right">
          <div className="user-profile-badge">
            <div className="avatar">
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-meta">
              <span className="user-name">{user?.username || 'Operator'}</span>
              <span className="user-role">{user?.email || 'admin@retrek.internal'}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="dashboard-body">
        {/* Backdrop */}
        {mobileMenuOpen && (
          <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Navigation Sidebar */}
        <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
          <nav className="dash-nav">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.key}
                className={`nav-tab ${activeKey === item.key ? 'is-active' : ''}`}
                onClick={() => handleNav(item.path)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="dashboard-content">
          {pages.map((page) => (
            <div
              key={page.key}
              style={{ display: activeKey === page.key ? 'block' : 'none' }}
            >
              {page.component}
            </div>
          ))}
        </main>
      </div>
      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
