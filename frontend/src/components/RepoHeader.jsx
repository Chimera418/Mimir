import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Code, GitPullRequest, CircleDot, GitBranch, Tag,
  GitCommit, Activity, ShieldCheck, History, Settings as SettingsIcon,
} from 'lucide-react';
import useRepoStore from '../store/repoStore';

const RepoTab = ({ to, icon: Icon, label, active }) => (
  <Link
    to={to}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.625rem 0.875rem',
      fontSize: '0.8125rem',
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      color: active ? 'var(--color-ink)' : 'var(--color-ink-3)',
      borderBottom: active ? '1px solid var(--color-accent)' : '1px solid transparent',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      transition: 'color 150ms ease-out',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--color-ink-2)'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--color-ink-3)'; }}
  >
    <Icon size={13} strokeWidth={1.75} />
    {label}
  </Link>
);

const RepoHeader = ({ owner, name, activeTab }) => {
  const { currentRepo, fetchRepoDetails } = useRepoStore();

  useEffect(() => {
    if (!currentRepo || currentRepo.name !== name || currentRepo.owner?.username !== owner) {
      fetchRepoDetails(owner, name);
    }
  }, [owner, name, currentRepo, fetchRepoDetails]);

  const tabs = [
    { to: `/${owner}/${name}`,             icon: Code,           label: 'Code',          active: activeTab === 'code' },
    { to: `/${owner}/${name}/issues`,       icon: CircleDot,      label: 'Issues',        active: activeTab === 'issues' },
    { to: `/${owner}/${name}/pulls`,        icon: GitPullRequest, label: 'Pull Requests', active: activeTab === 'pulls' },
    { to: `/${owner}/${name}/branches`,     icon: GitBranch,      label: 'Branches',      active: activeTab === 'branches' },
    { to: `/${owner}/${name}/releases`,     icon: Tag,            label: 'Releases',      active: activeTab === 'releases' },
    { to: `/${owner}/${name}/network`,      icon: GitCommit,      label: 'Network',       active: activeTab === 'network' },
    { to: `/${owner}/${name}/analytics`,    icon: Activity,       label: 'Analytics',     active: activeTab === 'analytics' },
    { to: `/${owner}/${name}/integrity`,    icon: ShieldCheck,    label: 'Integrity',     active: activeTab === 'integrity' },
    { to: `/${owner}/${name}/audit`,        icon: History,        label: 'Audit Log',     active: activeTab === 'audit' },
    { to: `/${owner}/${name}/settings`,     icon: SettingsIcon,   label: 'Settings',      active: activeTab === 'settings' },
  ];

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Title + Visibility */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
        <Link
          to={`/${owner}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--color-ink-2)',
            textDecoration: 'none',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-2)'}
        >
          {owner}
        </Link>
        <span style={{ color: 'var(--color-ink-4)', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>/</span>
        <Link
          to={`/${owner}/${name}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-ink)',
            textDecoration: 'none',
          }}
        >
          {name}
        </Link>
        {currentRepo?.visibility && (
          <span
            style={{
              marginLeft: '0.375rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 500,
              padding: '1px 6px',
              border: '1px solid var(--color-border)',
              borderRadius: '3px',
              color: 'var(--color-ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {currentRepo.visibility}
          </span>
        )}
      </div>

      {/* Description */}
      {currentRepo?.description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-2)', lineHeight: 1.55, marginBottom: '1rem' }}>
          {currentRepo.description}
        </p>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          borderBottom: '1px solid var(--color-border)',
          overflowX: 'auto',
          gap: 0,
        }}
      >
        {tabs.map(tab => (
          <RepoTab key={tab.to} {...tab} />
        ))}
      </div>
    </div>
  );
};

export default RepoHeader;

