import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitCommit, GitBranch, ArrowLeft, Loader2, Hash } from 'lucide-react';
import useRepoStore from '../store/repoStore';
import RepoHeader from '../components/RepoHeader';

const CommitHistory = () => {
  const { owner, name, branch } = useParams();
  const { commits, fetchCommits, currentRepo, fetchRepoDetails, isLoading, error } = useRepoStore();

  useEffect(() => {
    if (!currentRepo) {
      fetchRepoDetails(owner, name);
    }
  }, [owner, name, currentRepo, fetchRepoDetails]);

  useEffect(() => {
    if (branch) {
      fetchCommits(owner, name, branch);
    }
  }, [owner, name, branch, fetchCommits]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="code" />

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to={`/${owner}/${name}`}
            className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.3125rem 0.625rem' }}
          >
            <ArrowLeft size={13} strokeWidth={1.75} /> Code
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
            <GitBranch size={13} strokeWidth={1.75} style={{ color: 'var(--color-ink-3)' }} />
            <span>{branch}</span>
          </div>
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-4)' }}>
          {commits?.length || 0} commit{commits?.length !== 1 ? 's' : ''}
        </span>
      </div>

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
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Commit list container */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-1)',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
            <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading commits…
          </div>
        ) : !commits || commits.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--color-ink-3)' }}>
            <GitCommit size={24} strokeWidth={1.25} style={{ margin: '0 auto 0.75rem', color: 'var(--color-ink-4)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
              No commits yet
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
              This branch doesn't have any commits yet.
            </p>
          </div>
        ) : (
          <div>
            {commits.map((commit, idx) => (
              <div
                key={commit.sha}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.875rem 1rem',
                  borderBottom: idx === commits.length - 1 ? 'none' : '1px solid var(--color-border)',
                  transition: 'background-color 150ms ease-out',
                  gap: '1rem',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={`/${owner}/${name}/commit/${commit.sha}`}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-ink)',
                      textDecoration: 'none',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '0.25rem',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink)'}
                  >
                    {commit.message}
                  </Link>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                    <span>{commit.author?.username || 'Unknown'}</span>
                    <span>·</span>
                    <span>{new Date(commit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <Link
                  to={`/${owner}/${name}/commit/${commit.sha}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    textDecoration: 'none',
                    flexShrink: 0,
                    transition: 'border-color 150ms ease-out, color 150ms ease-out',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.color = 'var(--color-accent)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.color = 'var(--color-ink-3)';
                  }}
                >
                  {commit.sha.slice(0, 7)}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommitHistory;
