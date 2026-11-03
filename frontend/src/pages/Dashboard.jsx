import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderGit2, Lock, Globe, Plus, Star, GitFork, Loader2, X } from 'lucide-react';
import useRepoStore from '../store/repoStore';
import useAuthStore from '../store/authStore';

/* ── Repo card ─────────────────────────────────────────────────── */
const RepoCard = ({ repo }) => (
  <Link
    to={`/${repo.owner.username}/${repo.name}`}
    style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '1.125rem 1.25rem',
      backgroundColor: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      textDecoration: 'none',
      transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
      height: '100%',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = 'var(--color-accent-dim)';
      e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--color-border)';
      e.currentTarget.style.backgroundColor = 'var(--color-surface-1)';
    }}
  >
    {/* Header row */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--color-accent)',
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginRight: '0.5rem',
        }}
      >
        {repo.owner.username}/{repo.name}
      </span>
      {repo.visibility === 'private'
        ? <Lock size={12} strokeWidth={1.75} style={{ color: 'var(--color-ink-4)', flexShrink: 0, marginTop: '2px' }} />
        : <Globe size={12} strokeWidth={1.75} style={{ color: 'var(--color-ink-4)', flexShrink: 0, marginTop: '2px' }} />
      }
    </div>

    {/* Description */}
    <p
      style={{
        fontSize: '0.8125rem',
        color: 'var(--color-ink-2)',
        lineHeight: 1.55,
        flexGrow: 1,
        marginBottom: '1rem',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {repo.description || 'No description.'}
    </p>

    {/* Footer row */}
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginTop: 'auto',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
        <Star size={11} strokeWidth={1.5} /> {repo.stars || 0}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
        <GitFork size={11} strokeWidth={1.5} /> {repo.forks || 0}
      </span>
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
        {new Date(repo.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  </Link>
);

/* ── Create modal ──────────────────────────────────────────────── */
const CreateModal = ({ user, isLoading, onClose, onSubmit }) => {
  const [form, setForm] = useState({ name: '', description: '', visibility: 'public' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await onSubmit(form.name, form.description, form.visibility);
    if (res?.success) {
      onClose();
    } else if (res?.error) {
      setError(res.error);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          width: '100%',
          maxWidth: '440px',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9375rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
            }}
          >
            New repository
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-ink-3)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 150ms ease-out',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-3)'}
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div
              role="alert"
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
                borderRadius: '4px',
                color: 'var(--color-danger)',
                fontSize: '0.8125rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Repo name */}
          <div>
            <label
              htmlFor="repo-name"
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-ink-2)',
                marginBottom: '0.375rem',
              }}
            >
              Name <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: 'var(--color-surface-1)',
                transition: 'border-color 150ms ease-out',
              }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
            >
              <span
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--color-base)',
                  borderRight: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.username}/
              </span>
              <input
                id="repo-name"
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="my-project"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: '0.5rem 0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="repo-desc"
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-ink-2)',
                marginBottom: '0.375rem',
              }}
            >
              Description
            </label>
            <textarea
              id="repo-desc"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Short description of your project"
              style={{ resize: 'vertical', minHeight: '72px' }}
            />
          </div>

          {/* Visibility */}
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--color-ink-2)',
                marginBottom: '0.625rem',
              }}
            >
              Visibility
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { value: 'public', label: 'Public', Icon: Globe, hint: 'Anyone can see this repository.' },
                { value: 'private', label: 'Private', Icon: Lock, hint: 'Only you can access this repository.' },
              ].map(({ value, label, Icon, hint }) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    cursor: 'pointer',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '4px',
                    border: `1px solid ${form.visibility === value ? 'var(--color-accent-dim)' : 'var(--color-border)'}`,
                    backgroundColor: form.visibility === value ? 'var(--color-accent-bg)' : 'transparent',
                    transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
                  }}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={form.visibility === value}
                    onChange={() => setForm({ ...form, visibility: value })}
                    style={{ marginTop: '2px', accentColor: 'var(--color-accent)' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-ink)' }}>
                      <Icon size={12} strokeWidth={1.75} /> {label}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '2px' }}>{hint}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.625rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ fontSize: '0.8125rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ fontSize: '0.8125rem' }}
            >
              {isLoading && <Loader2 size={13} className="animate-spin" />}
              Create repository
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Dashboard ─────────────────────────────────────────────────── */
const Dashboard = () => {
  const { user } = useAuthStore();
  const { repos, fetchRepos, createRepo, isLoading, error } = useRepoStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleCreate = async (name, description, visibility) => {
    return createRepo(name, description, visibility);
  };

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.0625rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-ink)',
              marginBottom: '0.25rem',
            }}
          >
            Repositories
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
            {repos.length} {repos.length === 1 ? 'repository' : 'repositories'}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', flexShrink: 0 }}
        >
          <Plus size={14} strokeWidth={2} />
          New
        </button>
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
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && repos.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 0' }}>
          <Loader2 size={24} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--color-ink-4)' }} />
        </div>
      ) : repos.length === 0 ? (
        /* Empty state */
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-surface-1)',
          }}
        >
          <FolderGit2
            size={32}
            strokeWidth={1.25}
            style={{ color: 'var(--color-ink-4)', margin: '0 auto 1rem' }}
          />
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--color-ink)',
              marginBottom: '0.375rem',
            }}
          >
            No repositories yet
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', marginBottom: '1.5rem' }}>
            Create your first repository to get started.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            <Plus size={14} /> Create repository
          </button>
        </div>
      ) : (
        /* Repo grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}
        >
          {repos.map(repo => (
            <RepoCard key={repo._id} repo={repo} />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <CreateModal
          user={user}
          isLoading={isLoading}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
};

export default Dashboard;
