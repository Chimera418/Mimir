import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  GitCommit,
  GitBranch,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileCode,
  CheckCircle2,
  XCircle,
  Database,
  Sparkles,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import RepoHeader from '../components/RepoHeader';

const RepositoryIntegrity = () => {
  const { owner, name } = useParams();
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [integrityData, setIntegrityData] = useState(null);
  const [expandedCommit, setExpandedCommit] = useState(null);

  // Demo simulation state
  const [simulating, setSimulating] = useState(false);
  const [demoMessage, setDemoMessage] = useState(null);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get(`/repos/${owner}/${name}/branches`);
      const rawData = res.data?.data;
      const list = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.branches)
        ? rawData.branches
        : [];
      setBranches(list);

      const def = list.find((b) => b.isDefault);
      const activeBranchName = def?.name || list[0]?.name || 'main';
      setBranch(activeBranchName);
      return activeBranchName;
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      return 'main';
    }
  }, [owner, name]);

  const runVerification = useCallback(
    async (targetBranch = branch) => {
      try {
        setVerifying(true);
        setError('');
        const res = await api.get(
          `/repos/${owner}/${name}/integrity?branch=${encodeURIComponent(targetBranch || 'main')}`
        );
        setIntegrityData(res.data?.data || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to verify repository integrity');
      } finally {
        setVerifying(false);
        setLoading(false);
      }
    },
    [owner, name, branch]
  );

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      const initialBranch = await fetchBranches();
      if (isMounted) {
        await runVerification(initialBranch);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [fetchBranches, runVerification]);

  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setBranch(newBranch);
    runVerification(newBranch);
  };

  const handleSimulateTamper = async (tamperType) => {
    if (!integrityData || !integrityData.results || integrityData.results.length === 0) return;
    setSimulating(true);
    setDemoMessage(null);
    try {
      const targetCommit = integrityData.results[0]; // Tamper the HEAD commit or latest
      const res = await api.post(`/repos/${owner}/${name}/integrity/simulate-tamper`, {
        commitSha: targetCommit.sha,
        tamperType,
      });
      setDemoMessage({
        type: 'warning',
        text:
          res.data?.message ||
          'Database document altered! Click "Re-run Verification" to observe integrity failure.',
        sha: targetCommit.sha,
      });
      // Automatically re-verify to show failure immediately
      await runVerification(branch);
    } catch (err) {
      setDemoMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to simulate tampering',
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleHealTamper = async () => {
    if (!demoMessage?.sha && (!integrityData?.results || integrityData.results.length === 0)) return;
    const targetSha = demoMessage?.sha || integrityData.results[0].sha;
    setSimulating(true);
    try {
      const res = await api.post(`/repos/${owner}/${name}/integrity/heal`, {
        commitSha: targetSha,
      });
      setDemoMessage({
        type: 'success',
        text: res.data?.message || 'Tampered records restored to authentic cryptographic state.',
      });
      await runVerification(branch);
    } catch (err) {
      setDemoMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to heal commit records',
      });
    } finally {
      setSimulating(false);
    }
  };

  const isVerified = integrityData?.overallStatus === 'verified';
  const hasFailures = (integrityData?.failedCount || 0) > 0;

  if (loading && !integrityData) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-accent)', margin: '0 auto 1rem' }} />
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
          Verifying repository cryptographic integrity…
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="integrity" />

      {/* Control bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={16} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
            Cryptographic Integrity Verification
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '2px' }}>
            SHA-256 Merkle tree verification across commit parents & file blobs
          </p>
        </div>

        {/* Branch Selector & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.625rem', backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
            <GitBranch size={13} strokeWidth={1.75} style={{ color: 'var(--color-ink-3)' }} />
            <select
              value={branch}
              onChange={handleBranchChange}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}
            >
              {Array.isArray(branches) && branches.length > 0 ? (
                branches.map((b) => (
                  <option key={b._id || b.name} value={b.name} style={{ backgroundColor: 'var(--color-base)', color: 'var(--color-ink)' }}>
                    {b.name} {b.isDefault ? '(default)' : ''}
                  </option>
                ))
              ) : (
                <option value={branch} style={{ backgroundColor: 'var(--color-base)', color: 'var(--color-ink)' }}>
                  {branch}
                </option>
              )}
            </select>
          </div>

          <button
            onClick={() => runVerification(branch)}
            disabled={verifying}
            className="btn-primary"
            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
          >
            <RefreshCw size={12} strokeWidth={2} className={verifying ? 'animate-spin' : ''} />
            {verifying ? 'Verifying…' : 'Re-verify'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-4 rounded-xl mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => runVerification(branch)}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Status Banner */}
      {integrityData && (
        <div
          className={`border rounded-2xl p-6 mb-8 transition-all ${
            isVerified
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-red-500/10 border-red-500/40 text-red-400'
          }`}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-xl border ${
                  isVerified
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-red-500/20 border-red-500/40 text-red-400'
                }`}
              >
                {isVerified ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">
                    {isVerified ? 'Repository Integrity Verified' : 'Integrity Failures Detected'}
                  </h2>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isVerified
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {integrityData.overallStatus}
                  </span>
                </div>
                <p className="text-gray-300 text-sm mt-1 max-w-2xl">
                  {isVerified
                    ? 'All commit hashes in the DAG, parent linkage chains, and file-snapshot Merkle tree roots match their cryptographic signatures perfectly.'
                    : `Cryptographic audit detected ${integrityData.failedCount} corrupted or tampered record(s). Stored database data diverges from cryptographic root hashes.`}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 bg-dark-900/60 border border-dark-700/60 px-5 py-3 rounded-xl">
              <div className="text-center px-2">
                <span className="text-gray-400 text-xs block uppercase">Commits Checked</span>
                <span className="text-white font-mono font-bold text-lg">{integrityData.totalCommits ?? 0}</span>
              </div>
              <div className="h-8 w-px bg-dark-700" />
              <div className="text-center px-2">
                <span className="text-gray-400 text-xs block uppercase">Verified</span>
                <span className="text-emerald-400 font-mono font-bold text-lg">
                  {integrityData.verifiedCount ?? 0}
                </span>
              </div>
              <div className="h-8 w-px bg-dark-700" />
              <div className="text-center px-2">
                <span className="text-gray-400 text-xs block uppercase">Failures</span>
                <span className={`font-mono font-bold text-lg ${hasFailures ? 'text-red-400' : 'text-gray-400'}`}>
                  {integrityData.failedCount ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive DBMS Viva Demo Panel */}
      <div className="bg-dark-800/80 border border-dark-700 rounded-2xl p-6 mb-8 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-accent" />
            <h3 className="text-white font-bold text-base">
              DBMS Viva Demonstration: Controlled Tampering Simulation
            </h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-accent/10 text-accent border border-accent/20 font-medium">
            Viva Interactive Sandbox
          </span>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Demonstrate to examiners that our system reliably detects out-of-band database modifications. Modifying raw
          MongoDB documents invalidates deterministic SHA-256 signatures or Merkle roots without mutating expected hashes.
        </p>

        {demoMessage && (
          <div
            className={`p-3.5 rounded-xl border text-sm mb-4 flex items-center justify-between gap-3 ${
              demoMessage.type === 'warning'
                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
                : demoMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}
          >
            <span>{demoMessage.text}</span>
            <button
              onClick={() => setDemoMessage(null)}
              className="text-xs underline hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSimulateTamper('file_content')}
            disabled={simulating || !integrityData?.results?.length}
            className="bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white border border-dark-600 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCode size={14} className="text-amber-400" />
            Tamper File Content (MERKLE_ROOT_MISMATCH)
          </button>

          <button
            onClick={() => handleSimulateTamper('commit_message')}
            disabled={simulating || !integrityData?.results?.length}
            className="bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white border border-dark-600 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <GitCommit size={14} className="text-amber-400" />
            Tamper Commit Message (COMMIT_HASH_MISMATCH)
          </button>

          <button
            onClick={() => handleSimulateTamper('parent_link')}
            disabled={simulating || !integrityData?.results?.length}
            className="bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white border border-dark-600 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <GitBranch size={14} className="text-amber-400" />
            Break Parent Link (PARENT_LINK_BROKEN)
          </button>

          <button
            onClick={handleHealTamper}
            disabled={simulating}
            className="ml-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
          >
            <Sparkles size={14} />
            Restore / Heal Database State
          </button>
        </div>
      </div>

      {/* Commit Integrity Timeline Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <GitCommit size={18} className="text-accent" />
            Commit Verification History ({integrityData?.results?.length || 0})
          </h3>
          <span className="text-xs text-gray-500">Ordered by DAG topological ancestry</span>
        </div>

        {integrityData?.results && integrityData.results.length > 0 ? (
          <div className="divide-y divide-dark-700/60">
            {integrityData.results.map((commit, idx) => {
              const commitKey = commit.commitId || commit.sha || idx;
              const isExpanded = expandedCommit === commitKey;
              const hasPassed = commit.status === 'verified';
              const displaySha = commit.shortSha || (commit.sha ? commit.sha.slice(0, 8) : 'Unknown');

              return (
                <div
                  key={commitKey}
                  className={`transition-colors ${
                    !hasPassed ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-dark-700/40'
                  }`}
                >
                  <div
                    onClick={() => setExpandedCommit(isExpanded ? null : commitKey)}
                    className="px-6 py-4 flex items-center justify-between cursor-pointer select-none gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg ${
                          hasPassed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {hasPassed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {commit.sha ? (
                            <Link
                              to={`/${owner}/${name}/commit/${commit.sha}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-sm text-accent hover:underline flex items-center gap-1"
                            >
                              {displaySha}
                              <ExternalLink size={12} />
                            </Link>
                          ) : (
                            <span className="font-mono text-sm text-gray-400">{displaySha}</span>
                          )}
                          <span className="text-white font-medium text-sm truncate">
                            {commit.message || 'No commit message'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>by {commit.author || 'Unknown'}</span>
                          <span>·</span>
                          <span>
                            {commit.timestamp ? new Date(commit.timestamp).toLocaleString() : 'N/A'}
                          </span>
                          {commit.fileCount !== undefined && (
                            <>
                              <span>·</span>
                              <span>{commit.fileCount} file(s) in Merkle tree</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          hasPassed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {hasPassed ? 'Verified' : commit.errorType || 'Failed'}
                      </span>
                      <button className="text-gray-500 hover:text-white p-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details Drawer */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-dark-900/80 border-t border-dark-700/60 font-mono text-xs space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-gray-500 block mb-1">Commit SHA:</span>
                          <div className="bg-dark-950 p-2 rounded border border-dark-800 text-gray-300 break-all">
                            {commit.sha || 'N/A'}
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-500 block mb-1">Merkle Tree Root:</span>
                          <div className="bg-dark-950 p-2 rounded border border-dark-800 text-gray-300 break-all">
                            {commit.merkleRoot || commit.details?.expectedMerkleRoot || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {!hasPassed && commit.details && (
                        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 space-y-1">
                          <div className="font-bold text-red-400">Diagnosis: {commit.errorType}</div>
                          <p className="text-gray-300">{commit.details.description}</p>
                          {commit.details.expectedMerkleRoot && (
                            <div className="mt-2 text-xs">
                              <div>Expected Merkle Root: {commit.details.expectedMerkleRoot}</div>
                              <div>Actual Computed Root: {commit.details.actualMerkleRoot}</div>
                            </div>
                          )}
                          {commit.details.expectedSha && (
                            <div className="mt-2 text-xs">
                              <div>Expected Commit SHA: {commit.details.expectedSha}</div>
                              <div>Actual Computed SHA: {commit.details.actualSha}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">
            No commits found for branch <span className="font-mono text-gray-400">{branch}</span>.
          </div>
        )}
      </div>
    </div>
  );
};

export default RepositoryIntegrity;
