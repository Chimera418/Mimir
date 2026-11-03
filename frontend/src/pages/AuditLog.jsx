import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  History,
  ArrowLeft,
  Search,
  Filter,
  ShieldAlert,
  GitCommit,
  GitMerge,
  RotateCcw,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import RepoHeader from '../components/RepoHeader';

const ACTION_CONFIG = {
  commit_created: { label: 'Commit Created', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: GitCommit },
  branch_merged: { label: 'Branch Merged', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', icon: GitMerge },
  commit_reverted: { label: 'Commit Reverted', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: RotateCcw },
  integrity_verified: { label: 'Integrity Verified', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: ShieldCheck },
  security_violation: { label: 'Security Violation', color: 'bg-red-500/15 text-red-400 border-red-500/40', icon: ShieldAlert },
  branch_protected: { label: 'Branch Protected', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', icon: Lock },
  branch_unprotected: { label: 'Branch Unprotected', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30', icon: Unlock },
};

const AuditLog = () => {
  const { owner, name } = useParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [actionFilter, setActionFilter] = useState('all');
  const [userQuery, setUserQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortOrder,
      });

      if (actionFilter && actionFilter !== 'all') {
        params.append('action', actionFilter);
      }
      if (userQuery.trim()) {
        params.append('username', userQuery.trim());
      }

      const res = await api.get(`/repos/${owner}/${name}/audit?${params.toString()}`);
      setLogs(res.data.data || []);
      setTotal(res.data.pagination?.total || res.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [owner, name, page, limit, actionFilter, userQuery, sortOrder]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="audit" />

      {/* Header description */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={16} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
          Repository Audit Trail
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '2px' }}>
          Immutable ledger of branch modifications, reversions, and security operations
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Action Filter */}
          <div className="flex items-center gap-2 bg-dark-900 border border-dark-700 px-3 py-1.5 rounded-xl text-sm">
            <Filter size={14} className="text-gray-400" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-dark-900 text-white">All Actions</option>
              <option value="commit_created" className="bg-dark-900 text-white">Commit Created</option>
              <option value="branch_merged" className="bg-dark-900 text-white">Branch Merged</option>
              <option value="commit_reverted" className="bg-dark-900 text-white">Commit Reverted</option>
              <option value="integrity_verified" className="bg-dark-900 text-white">Integrity Verified</option>
              <option value="security_violation" className="bg-dark-900 text-white">Security Violation</option>
              <option value="branch_protected" className="bg-dark-900 text-white">Branch Protected</option>
              <option value="branch_unprotected" className="bg-dark-900 text-white">Branch Unprotected</option>
            </select>
          </div>

          {/* User Search Input */}
          <div className="flex items-center gap-2 bg-dark-900 border border-dark-700 px-3 py-1.5 rounded-xl text-sm flex-1 min-w-[180px]">
            <Search size={14} className="text-gray-500" />
            <input
              type="text"
              placeholder="Filter by username (e.g. alice)..."
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-white placeholder-gray-500 focus:outline-none text-xs w-full"
            />
          </div>
        </div>

        {/* Sort & Quick Stats */}
        <div className="flex items-center gap-3">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="bg-dark-900 border border-dark-700 text-gray-300 text-xs px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
          <span className="text-xs text-gray-500 font-mono">
            {total} total event{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-accent mb-3" />
            <span className="text-sm">Loading audit entries...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <History size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No audit log records found matching your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700/60">
            {logs.map((log) => {
              const config = ACTION_CONFIG[log.action] || {
                label: log.action,
                color: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
                icon: Clock,
              };
              const IconComponent = config.icon;
              const isExpanded = expandedRow === log._id;

              return (
                <div key={log._id} className="hover:bg-dark-750 transition-colors">
                  <div
                    onClick={() => setExpandedRow(isExpanded ? null : log._id)}
                    className="px-6 py-4 flex items-center justify-between cursor-pointer gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-dark-900 border border-dark-700 text-gray-300">
                        <IconComponent size={16} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${config.color}`}
                          >
                            {config.label}
                          </span>
                          <span className="text-white text-sm font-medium">
                            {log.metadata?.message || log.metadata?.reason || log.metadata?.branch || log.action}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-gray-400">
                            <UserIcon size={12} />
                            {log.user?.username || 'system'}
                          </span>
                          <span>·</span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                          {log.metadata?.sha && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-accent">{log.metadata.sha.slice(0, 8)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500">
                      <span className="text-xs font-mono hidden md:inline">ID: {log._id.slice(-6)}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Metadata JSON Drawer */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-dark-900/90 border-t border-dark-700/60 font-mono text-xs text-gray-300 space-y-2">
                      <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
                        <span>Event Metadata & Diagnostics</span>
                        <span>Document ID: {log._id}</span>
                      </div>
                      <pre className="bg-dark-950 p-3 rounded-lg border border-dark-800 overflow-x-auto text-emerald-400">
                        {JSON.stringify(log.metadata || {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-dark-700 flex items-center justify-between text-xs text-gray-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 bg-dark-900 border border-dark-700 hover:bg-dark-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors text-white"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 bg-dark-900 border border-dark-700 hover:bg-dark-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors text-white"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
