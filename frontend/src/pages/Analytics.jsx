import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import useRepoStore from '../store/repoStore';
import {
  Activity,
  GitCommit,
  GitPullRequest,
  GitMerge,
  AlertCircle,
  Loader2,
  FileCode,
  TrendingUp,
  ShieldAlert,
  Clock,
  Users,
  Search,
  History,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import RepoHeader from '../components/RepoHeader';

const Analytics = () => {
  const { owner, name } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentRepo, fetchRepoDetails } = useRepoStore();

  const activeSubTab = searchParams.get('tab') || 'overview';
  const queryFilePath = searchParams.get('path') || '';

  const [stats, setStats] = useState(null);
  const [branchAge, setBranchAge] = useState([]);
  const [conflictStats, setConflictStats] = useState(null);
  const [fileOwnership, setFileOwnership] = useState([]);
  const [fileHistory, setFileHistory] = useState(null);
  const [selectedPath, setSelectedPath] = useState(queryFilePath);
  const [searchingHistory, setSearchingHistory] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentRepo) {
      fetchRepoDetails(owner, name);
    }
  }, [owner, name, currentRepo, fetchRepoDetails]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [modFiles, branchStats, mergeStats, prStats, issueStats, growth, branchesRes, conflictsRes, ownershipRes] = await Promise.all([
          api.get(`/analytics/repos/${owner}/${name}/modified-files`),
          api.get(`/analytics/repos/${owner}/${name}/branch-stats`),
          api.get(`/analytics/repos/${owner}/${name}/merge-stats`),
          api.get(`/analytics/repos/${owner}/${name}/pr-stats`),
          api.get(`/analytics/repos/${owner}/${name}/issue-stats`),
          api.get(`/analytics/repos/${owner}/${name}/growth`),
          api.get(`/analytics/repos/${owner}/${name}/branch-age`).catch(() => ({ data: { data: { branches: [] } } })),
          api.get(`/analytics/repos/${owner}/${name}/conflict-stats`).catch(() => ({ data: { data: null } })),
          api.get(`/analytics/repos/${owner}/${name}/file-ownership`).catch(() => ({ data: { data: { ownership: [] } } })),
        ]);

        setStats({
          mostModifiedFiles: modFiles.data.data?.data || modFiles.data.data || [],
          branches: branchStats.data.data?.branches ?? branchStats.data.branches ?? 0,
          merges: mergeStats.data.data?.merges || mergeStats.data.merges || { merge: 0, squash: 0 },
          pullRequests: prStats.data.data?.pullRequests || prStats.data.pullRequests || { open: 0, merged: 0, closed: 0 },
          issues: issueStats.data.data?.issues || issueStats.data.issues || { open: 0, closed: 0 },
          growth: growth.data.data?.growth || growth.data.growth || []
        });

        setBranchAge(branchesRes.data.data?.branches || []);
        setConflictStats(conflictsRes.data.data || null);
        setFileOwnership(ownershipRes.data.data?.ownership || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [owner, name]);

  // Handle Global File History Lookup
  const handleFetchFileHistory = async (pathTarget) => {
    const target = pathTarget || selectedPath;
    if (!target) return;
    try {
      setSearchingHistory(true);
      const res = await api.get(`/analytics/repos/${owner}/${name}/file-history?path=${encodeURIComponent(target)}`);
      setFileHistory(res.data.data);
    } catch {
      setFileHistory({ filePath: target, versions: [] });
    } finally {
      setSearchingHistory(false);
    }
  };

  useEffect(() => {
    if (queryFilePath) {
      setSelectedPath(queryFilePath);
      handleFetchFileHistory(queryFilePath);
    }
  }, [queryFilePath]);

  const setTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="analytics" />

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
            borderRadius: '4px',
            color: 'var(--color-danger)',
            fontSize: '0.8125rem',
            marginBottom: '1.25rem',
          }}
        >
          <AlertCircle size={14} strokeWidth={1.75} /> {error}
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <SubTabBtn active={activeSubTab === 'overview'} onClick={() => setTab('overview')} label="Overview" icon={Activity} />
        <SubTabBtn active={activeSubTab === 'conflicts'} onClick={() => setTab('conflicts')} label="Conflict Hotspots & Security" icon={Flame} />
        <SubTabBtn active={activeSubTab === 'ownership'} onClick={() => setTab('ownership')} label="Code Ownership" icon={Users} />
        <SubTabBtn active={activeSubTab === 'lifecycle'} onClick={() => setTab('lifecycle')} label="Branch Lifecycle" icon={Clock} />
        <SubTabBtn active={activeSubTab === 'file-history'} onClick={() => setTab('file-history')} label="Global File History" icon={History} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
          <Loader2 size={20} strokeWidth={1.5} className="animate-spin" /> Aggregating repository telemetry…
        </div>
      ) : (
        <div>
          {/* TAB 1: OVERVIEW */}
          {activeSubTab === 'overview' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: '1px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--color-border)',
                }}
              >
                <StatMetric title="Branches" icon={GitCommit} value={stats.branches} />
                <StatMetric
                  title="Pull Requests"
                  icon={GitPullRequest}
                  value={(stats.pullRequests.open || 0) + (stats.pullRequests.merged || 0) + (stats.pullRequests.closed || 0)}
                  sub={`${stats.pullRequests.open || 0} open · ${stats.pullRequests.merged || 0} merged`}
                />
                <StatMetric
                  title="Issues"
                  icon={AlertCircle}
                  value={(stats.issues.open || 0) + (stats.issues.closed || 0)}
                  sub={`${stats.issues.open || 0} open · ${stats.issues.closed || 0} closed`}
                />
                <StatMetric
                  title="Merges"
                  icon={GitMerge}
                  value={(stats.merges.merge || 0) + (stats.merges.squash || 0)}
                  sub={`${stats.merges.merge || 0} standard · ${stats.merges.squash || 0} squash`}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem' }}>
                {/* Most modified files */}
                <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileCode size={15} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
                      <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                        Most modified files
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-ink-4)', fontFamily: 'var(--font-mono)' }}>MongoDB $group</span>
                  </div>

                  {stats.mostModifiedFiles?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {stats.mostModifiedFiles.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: 'var(--color-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '0.75rem' }}>
                            {f.file}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPath(f.file);
                              setTab('file-history');
                              handleFetchFileHistory(f.file);
                            }}
                            className="btn-ghost"
                            style={{ fontSize: '0.6875rem', padding: '1px 6px', whiteSpace: 'nowrap' }}
                            title="Trace global history across all branches"
                          >
                            {f.changes} changes →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-4)' }}>No modified files recorded.</p>
                  )}
                </div>

                {/* Commit activity */}
                <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingUp size={15} strokeWidth={1.75} style={{ color: 'var(--color-success)' }} />
                      <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                        Commit cadence (monthly)
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-ink-4)', fontFamily: 'var(--font-mono)' }}>$dateToString pipeline</span>
                  </div>

                  {stats.growth?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {(() => {
                        const maxCommits = Math.max(...stats.growth.map((g) => g.commits || 1), 1);
                        return stats.growth.map((g, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ width: '80px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                              {g.date}
                            </span>
                            <div style={{ flex: 1, backgroundColor: 'var(--color-base)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, (g.commits / maxCommits) * 100)}%`,
                                  height: '100%',
                                  backgroundColor: 'var(--color-accent)',
                                  borderRadius: '3px',
                                }}
                              />
                            </div>
                            <span style={{ width: '36px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-2)' }}>
                              {g.commits}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-4)' }}>No commit growth data available.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFLICT HOTSPOTS & SECURITY */}
          {activeSubTab === 'conflicts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Flame size={16} strokeWidth={1.75} style={{ color: 'var(--color-warning)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>Conflict Resolutions</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                    {conflictStats?.totalConflictResolutions || 0}
                  </span>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--color-ink-4)', marginTop: '0.25rem' }}>
                    Commits created by 3-way conflict resolution engine
                  </p>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <ShieldAlert size={16} strokeWidth={1.75} style={{ color: 'var(--color-danger)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>Security Violations Logged</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                    {(conflictStats?.securityViolations || []).reduce((acc, curr) => acc + curr.count, 0)}
                  </span>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--color-ink-4)', marginTop: '0.25rem' }}>
                    Protected branch or OCC invariant violations blocked
                  </p>
                </div>
              </div>

              {/* Hot Conflict Files */}
              <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={15} strokeWidth={1.75} style={{ color: 'var(--color-warning)' }} />
                  Hotspot Files (Most frequent merge conflict targets)
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '1rem' }}>
                  Files that repeatedly require manual 3-way resolution during PR integration. GitHub does not compute or expose this metric.
                </p>

                {conflictStats?.hotConflictFiles?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {conflictStats.hotConflictFiles.map((hf, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--color-base)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-2)' }}>
                          {hf.file}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-warning)' }}>
                          {hf.conflictCount} conflict resolutions
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-4)' }}>No conflict resolution hotspots recorded yet.</p>
                )}
              </div>

              {/* Security Violations Breakdown */}
              <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={15} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
                  ACID & Protection Guard Audits
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '1rem' }}>
                  Direct database audit events logged by Mímir's permission and transaction middleware.
                </p>

                {conflictStats?.securityViolations?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {conflictStats.securityViolations.map((v, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--color-base)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '4px',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-2)' }}>{v.reason || 'Unauthorized operation'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-danger)' }}>{v.count} attempts blocked</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-base)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-success)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={14} /> Zero unauthorized branch access violations recorded in audit trail.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CODE OWNERSHIP */}
          {activeSubTab === 'ownership' && (
            <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={15} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
                  Contributor Code Ownership Matrix
                </h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                  Computed via $lookup & $group
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '1.25rem' }}>
                Relative authorship and modification share per file. Allows identifying single-contributor bottlenecks and knowledge silos.
              </p>

              {fileOwnership.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-4)' }}>No ownership records found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fileOwnership.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--color-base)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                          {item.file}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                          {item.totalEdits} total revisions
                        </span>
                      </div>

                      {/* Percentage Bar */}
                      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', backgroundColor: 'var(--color-surface-2)', marginBottom: '0.5rem' }}>
                        {item.contributors.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            style={{
                              width: `${c.percentage}%`,
                              backgroundColor: cIdx === 0 ? 'var(--color-accent)' : cIdx === 1 ? '#6b7ae8' : '#c47a3e',
                            }}
                            title={`${c.author}: ${c.percentage}% (${c.edits} edits)`}
                          />
                        ))}
                      </div>

                      {/* Breakdown badges */}
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {item.contributors.map((c, cIdx) => (
                          <span key={cIdx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cIdx === 0 ? 'var(--color-accent)' : cIdx === 1 ? '#6b7ae8' : '#c47a3e' }} />
                            <span>{c.author}</span>
                            <span style={{ color: 'var(--color-ink-4)' }}>({c.percentage}%)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BRANCH LIFECYCLE */}
          {activeSubTab === 'lifecycle' && (
            <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={15} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
                  Branch Lifecycle & Age Distribution
                </h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                  {branchAge.length} active branches
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '1.25rem' }}>
                Tracks branch staleness and protection status across the commit DAG to detect unmerged feature branches.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {branchAge.map((b) => (
                  <div
                    key={b._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--color-base)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <GitBranch size={14} style={{ color: b.isDefault ? 'var(--color-accent)' : 'var(--color-ink-4)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                        {b.name}
                      </span>
                      {b.isDefault && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--color-accent-bg)', color: 'var(--color-accent)', border: '1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)' }}>
                          default
                        </span>
                      )}
                      {b.isProtected && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }}>
                          protected
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-3)' }}>
                      <span>creator: <span style={{ color: 'var(--color-ink-2)' }}>{b.creator}</span></span>
                      <span>HEAD: <span style={{ color: 'var(--color-accent-dim)' }}>{b.headSha || 'none'}</span></span>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor: b.ageDays > 30 ? 'color-mix(in oklch, var(--color-warning) 15%, transparent)' : 'var(--color-surface-2)',
                          color: b.ageDays > 30 ? 'var(--color-warning)' : 'var(--color-ink-3)',
                        }}
                      >
                        {b.ageDays === 0 ? 'Created today' : `${b.ageDays} days active`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: GLOBAL FILE HISTORY ACROSS BRANCHES */}
          {activeSubTab === 'file-history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={15} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
                    Global File Evolution Across All Branches
                  </h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-accent)' }}>
                    MongoDB-Native Cross-Branch Query
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '1rem' }}>
                  In GitHub, file history only shows commits on the current branch. In Mímir, every snapshot is indexed in the <code style={{ color: 'var(--color-accent)' }}>FileVersion</code> collection, allowing you to trace a file's entire mutation timeline across all branches simultaneously.
                </p>

                {/* Path input & search */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleFetchFileHistory();
                  }}
                  style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}
                >
                  <input
                    type="text"
                    value={selectedPath}
                    onChange={(e) => setSelectedPath(e.target.value)}
                    placeholder="Enter file path (e.g. README.md, src/index.js, gg.txt)..."
                    className="input"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  />
                  <button type="submit" disabled={searchingHistory} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0 1rem' }}>
                    {searchingHistory ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                    <span>Trace History</span>
                  </button>
                </form>

                {/* Quick suggestions from most modified files */}
                {stats?.mostModifiedFiles?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>Quick pick:</span>
                    {stats.mostModifiedFiles.slice(0, 5).map((f) => (
                      <button
                        key={f.file}
                        type="button"
                        onClick={() => {
                          setSelectedPath(f.file);
                          handleFetchFileHistory(f.file);
                        }}
                        className="btn-ghost"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '1px 6px' }}
                      >
                        {f.file}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* History Results Timeline */}
              {fileHistory && (
                <div style={{ backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                      History for <code style={{ color: 'var(--color-accent)' }}>{fileHistory.filePath}</code>
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                      {fileHistory.versions?.length || 0} recorded revision snapshots
                    </span>
                  </div>

                  {fileHistory.versions?.length === 0 ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-4)', textAlign: 'center', padding: '1.5rem 0' }}>
                      No versions recorded for this file path.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {fileHistory.versions.map((ver) => (
                        <div
                          key={ver._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            backgroundColor: 'var(--color-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '4px',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                                v{ver.versionNumber}
                              </span>
                              {ver.commit?.branch?.name && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-accent)' }}>
                                  branch: {ver.commit.branch.name}
                                </span>
                              )}
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                                {ver.commit?.message || 'Commit snapshot'}
                              </span>
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                              by {ver.commit?.author?.username || 'unknown'} · {new Date(ver.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                              SHA-256: {ver.contentHash?.slice(0, 10)}…
                            </span>
                            {ver.commit?.sha && (
                              <Link
                                to={`/${owner}/${name}/commit/${ver.commit.sha}`}
                                className="btn-ghost"
                                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '2px 6px' }}
                              >
                                {ver.commit.sha.slice(0, 7)} →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SubTabBtn = ({ active, onClick, label, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="btn-ghost"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      padding: '0.375rem 0.625rem',
      borderRadius: '4px',
      color: active ? 'var(--color-accent)' : 'var(--color-ink-3)',
      backgroundColor: active ? 'var(--color-surface-2)' : 'transparent',
      borderColor: active ? 'color-mix(in oklch, var(--color-accent) 40%, transparent)' : 'transparent',
      whiteSpace: 'nowrap',
    }}
  >
    <Icon size={13} strokeWidth={1.75} />
    <span>{label}</span>
  </button>
);

const StatMetric = ({ title, icon: Icon, value, sub }) => (
  <div
    style={{
      backgroundColor: 'var(--color-surface-1)',
      padding: '1.125rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-ink-3)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500 }}>{title}</span>
      <Icon size={14} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
    </div>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-ink)' }}>
      {value || 0}
    </span>
    {sub && (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
        {sub}
      </span>
    )}
  </div>
);

export default Analytics;
