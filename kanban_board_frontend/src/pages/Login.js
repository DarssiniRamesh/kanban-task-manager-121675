import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * PUBLIC_INTERFACE
 * Login page for dummy frontend-only auth (Reader/Editor).
 * Shows hardcoded credentials for demo use.
 */
export default function Login() {
  const { login, dummyCredentials } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login({ username, password });
      if (!res.ok) {
        setError(res.error || 'Login failed.');
        return;
      }
      nav(from, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 96, paddingBottom: 40 }}>
      <h1 className="page-title">Sign in</h1>
      <p className="page-subtitle" style={{ maxWidth: 820 }}>
        This is a <strong>frontend-only demo login</strong> with hardcoded users. Choose a role and sign in.
        Reader is view-only; Editor can create/edit/delete and drag/move items.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.08)',
          maxWidth: 820,
        }}
        aria-label="Demo users"
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Demo users</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          {dummyCredentials.map((c) => (
            <li key={c.role}>
              <strong style={{ textTransform: 'capitalize' }}>{c.role}</strong>: username <code>{c.username}</code>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          For security reasons, passwords are not displayed in the UI.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 18, maxWidth: 520 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="reader or editor"
              style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              type="password"
              placeholder="Enter password"
              style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.18)' }}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                padding: 10,
                borderRadius: 10,
                background: 'rgba(193, 58, 43, 0.10)',
                border: '1px solid rgba(193, 58, 43, 0.25)',
                color: '#8a1f14',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Note: This login is not secure and does not protect your Supabase keys. It only gates UI capabilities.
          </div>
        </div>
      </form>
    </div>
  );
}
