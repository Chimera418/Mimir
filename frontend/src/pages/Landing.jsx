import { Link } from 'react-router-dom';
import { Database, GitBranch, Zap, Shield, ArrowRight } from 'lucide-react';
import useAuthStore from '../store/authStore';

const Landing = () => {
  const { user } = useAuthStore();

  const features = [
    {
      icon: Database,
      label: 'Database-First Engine',
      description:
        'Commits, branches, and file trees live entirely in MongoDB. ACID transactions guarantee commit integrity at every write.',
    },
    {
      icon: GitBranch,
      label: 'Pointer-Based Branching',
      description:
        'Branches cost no storage. Mímir uses reference pointers and Merkle Trees to track state across time without duplicating files.',
    },
    {
      icon: Zap,
      label: 'Aggregation Analytics',
      description:
        'Contribution graphs, commit timelines, and repository growth computed in real time using MongoDB aggregation pipelines.',
    },
    {
      icon: Shield,
      label: 'Integrity Verification',
      description:
        'SHA-256 hashed blobs and tree nodes allow tamper detection at any depth. Every commit is cryptographically verifiable.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 48px)' }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '6rem 1.5rem 5rem',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Eyebrow — just one, deliberate */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.06em',
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
            marginBottom: '1.75rem',
          }}
        >
          version control system · dbms semester project
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 'clamp(2.25rem, 5vw, 4rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: 'var(--color-ink)',
            maxWidth: '26ch',
            marginBottom: '1.5rem',
          }}
        >
          Where databases{' '}
          <span style={{ color: 'var(--color-accent)' }}>are</span>{' '}
          the version control.
        </h1>

        <p
          style={{
            fontSize: '1.0625rem',
            color: 'var(--color-ink-2)',
            lineHeight: 1.7,
            maxWidth: '52ch',
            marginBottom: '2.5rem',
          }}
        >
          Mímir brings Git-style version control into MongoDB — commits, branches,
          diffs, pull requests, and analytics, all stored as documents and queried
          with aggregation pipelines.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user ? (
            <Link
              to="/dashboard"
              className="btn-primary"
              style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
            >
              Open dashboard <ArrowRight size={14} strokeWidth={2} />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="btn-primary"
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
              >
                Create account <ArrowRight size={14} strokeWidth={2} />
              </Link>
              <Link
                to="/login"
                className="btn-ghost"
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── Horizontal rule ───────────────────────────────────── */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

      {/* ── Feature grid ──────────────────────────────────────── */}
      <section
        style={{
          padding: '4rem 1.5rem',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-3)',
            marginBottom: '2.5rem',
          }}
        >
          Core capabilities
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {features.map(({ icon: Icon, label, description }) => (
            <FeatureCell key={label} Icon={Icon} label={label} description={description} />
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '900px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-4)' }}>
          mímir vcs
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-4)' }}>
          built on node.js · mongodb
        </span>
      </footer>
    </div>
  );
};

/* ── Feature cell — grid item with internal border ────────────── */
const FeatureCell = ({ Icon, label, description }) => (
  <div
    style={{
      backgroundColor: 'var(--color-surface-1)',
      padding: '1.75rem',
      borderRight: '1px solid var(--color-border)',
      borderBottom: '1px solid var(--color-border)',
      transition: 'background-color 150ms ease-out',
      cursor: 'default',
    }}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-1)'}
  >
    <Icon
      size={18}
      strokeWidth={1.5}
      style={{ color: 'var(--color-accent)', marginBottom: '1rem' }}
    />
    <p
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--color-ink)',
        marginBottom: '0.625rem',
        letterSpacing: '-0.01em',
      }}
    >
      {label}
    </p>
    <p
      style={{
        fontSize: '0.8125rem',
        color: 'var(--color-ink-2)',
        lineHeight: 1.65,
      }}
    >
      {description}
    </p>
  </div>
);

export default Landing;
