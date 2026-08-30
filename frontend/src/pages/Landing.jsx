import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Landing({ navigate }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  return (
    <main className="landing-page">
      <header className="site-header" aria-label="Primary navigation">
        <a
          className="brand"
          href="/"
          aria-label="Retrek home"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <span>Retrek</span>
        </a>

        <nav className="header-actions" aria-label="Account actions">
          {isAuthenticated ? (
            <>
              <a
                className="button-link"
                href="/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/dashboard');
                }}
              >
                Dashboard
              </a>
              <button
                type="button"
                className="text-link cursor-pointer"
                onClick={logout}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a
                className="text-link"
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
              >
                Login
              </a>
              <a
                className="button-link"
                href="/signup"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/signup');
                }}
              >
                Sign up
              </a>
            </>
          )}
        </nav>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Open account menu"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-account-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div
          className={`mobile-menu ${isMenuOpen ? 'is-open' : ''}`}
          id="mobile-account-menu"
        >
          {isAuthenticated ? (
            <>
              <a
                className="mobile-menu-link mobile-login"
                href="/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/dashboard');
                }}
              >
                Go to Dashboard
              </a>
              <button
                type="button"
                className="mobile-menu-link mobile-signup"
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                style={{ border: 'none', width: '100%', cursor: 'pointer' }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <a
                className="mobile-menu-link mobile-login"
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
              >
                Login
              </a>
              <a
                className="mobile-menu-link mobile-signup"
                href="/signup"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/signup');
                }}
              >
                Sign up
              </a>
            </>
          )}
        </div>
      </header>

      {/* Hero section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="badge">AI-Powered Payment Recovery</div>
          <h1 className="hero-title">
            Autonomous payment failure recovery with policy safety gates.
          </h1>
          <p className="hero-desc">
            Retrek maps ISO-8583 payment decline codes, routes failures through AI reasoning
            and deterministic safety policies, executing recoveries via Razorpay and human approvals.
          </p>
        </div>
      </section>
    </main>
  );
}
