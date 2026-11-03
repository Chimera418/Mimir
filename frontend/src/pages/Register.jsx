import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { GitGraph, Loader2 } from 'lucide-react';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const res = await register(username, email, password);
    setIsSubmitting(false);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 48px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        backgroundColor: 'var(--color-base)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo mark */}
        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <GitGraph
              size={16}
              strokeWidth={1.75}
              style={{ color: 'var(--color-accent)' }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-ink)',
                letterSpacing: '-0.01em',
              }}
            >
              mímir
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.25rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              marginBottom: '0.375rem',
            }}
          >
            Create account
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>
            Join Mímir and start tracking your repositories.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '0.625rem 0.875rem',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
              borderRadius: '4px',
              color: 'var(--color-danger)',
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-ink-2)',
                marginBottom: '0.375rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input"
              placeholder="yourhandle"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-ink-2)',
                marginBottom: '0.375rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-ink-2)',
                marginBottom: '0.375rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{ width: '100%', padding: '0.625rem', marginTop: '0.5rem', fontSize: '0.875rem' }}
          >
            {isSubmitting
              ? <><Loader2 size={14} className="animate-spin" /> creating account…</>
              : 'Create account'
            }
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--color-ink-3)',
            marginTop: '1.5rem',
          }}
        >
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--color-accent)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
