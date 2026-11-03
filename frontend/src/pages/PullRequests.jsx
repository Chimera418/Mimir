import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GitPullRequest, Plus, Loader2, AlertCircle, GitMerge, X, ArrowRight } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const PullRequests = () => {
  const { owner, name } = useParams();
  const { user } = useAuthStore();
  const [prs, setPrs] = useState([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", sourceBranchName: "", targetBranchName: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchPRs = async (s) => {
    try {
      setLoading(true);
      const res = await api.get(`/repos/${owner}/${name}/pulls?status=${s}&limit=50`);
      const data = res.data.data;
      setPrs(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load pull requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get(`/repos/${owner}/${name}/branches`);
      const data = res.data.data;
      setBranches(Array.isArray(data) ? data : data.branches || []);
    } catch (_) {}
  };

  useEffect(() => {
    fetchPRs(status);
    fetchBranches();
  }, [owner, name, status]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!form.title.trim() || !form.sourceBranchName || !form.targetBranchName) {
      setCreateError("All fields are required");
      return;
    }
    setCreating(true);
    try {
      await api.post(`/repos/${owner}/${name}/pulls`, form);
      setShowCreate(false);
      setForm({ title: "", description: "", sourceBranchName: "", targetBranchName: "" });
      await fetchPRs(status);
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create pull request");
    } finally {
      setCreating(false);
    }
  };

  const statusIcons = {
    open: <GitPullRequest size={15} strokeWidth={1.75} style={{ color: 'var(--color-success)' }} />,
    merged: <GitMerge size={15} strokeWidth={1.75} style={{ color: '#a78bfa' }} />,
    closed: <X size={15} strokeWidth={1.75} style={{ color: 'var(--color-danger)' }} />,
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="pulls" />

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Status filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {["open", "merged", "closed", "all"].map(s => {
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                  padding: '0.375rem 0.625rem',
                  borderRadius: '4px',
                  color: active ? 'var(--color-ink)' : 'var(--color-ink-3)',
                  backgroundColor: active ? 'var(--color-surface-2)' : 'transparent',
                  transition: 'color 150ms ease-out, background-color 150ms ease-out',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--color-ink-2)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--color-ink-3)'; }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Action */}
        {user && (
          <button
            onClick={() => { setShowCreate(v => !v); setCreateError(""); }}
            className="btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            <Plus size={14} strokeWidth={2} /> New PR
          </button>
        )}
      </div>

      {/* Global Error */}
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
            marginBottom: '1rem',
          }}
        >
          <AlertCircle size={14} strokeWidth={1.75} /> {error}
        </div>
      )}

      {/* Create PR Form */}
      {showCreate && (
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '1.25rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
              Open a pull request
            </h3>
            <button
              onClick={() => setShowCreate(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-3)', padding: '2px' }}
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          {createError && (
            <div
              role="alert"
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
                borderRadius: '4px',
                color: 'var(--color-danger)',
                fontSize: '0.8125rem',
                marginBottom: '0.875rem',
              }}
            >
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Title *"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="input"
              required
            />
            <textarea
              placeholder="Description (optional)…"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="input"
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                  Source branch *
                </label>
                <select
                  value={form.sourceBranchName}
                  onChange={e => setForm({ ...form, sourceBranchName: e.target.value })}
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  required
                >
                  <option value="">Select source branch</option>
                  {branches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                  Target branch *
                </label>
                <select
                  value={form.targetBranchName}
                  onChange={e => setForm({ ...form, targetBranchName: e.target.value })}
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  required
                >
                  <option value="">Select target branch</option>
                  {branches.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="btn-ghost"
                style={{ fontSize: '0.8125rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary"
                style={{ fontSize: '0.8125rem' }}
              >
                {creating ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : 'Open pull request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PRs list container */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-1)',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
            <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading pull requests…
          </div>
        ) : prs.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--color-ink-3)' }}>
            <GitPullRequest size={24} strokeWidth={1.25} style={{ margin: '0 auto 0.75rem', color: 'var(--color-ink-4)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
              No {status === "all" ? "" : status} pull requests
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
              There aren't any {status === "all" ? "" : status} pull requests in this repository.
            </p>
          </div>
        ) : (
          <div>
            {prs.map((pr, idx) => (
              <Link
                key={pr._id}
                to={`/${owner}/${name}/pulls/${pr.number}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '0.875rem 1rem',
                  borderBottom: idx === prs.length - 1 ? 'none' : '1px solid var(--color-border)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background-color 150ms ease-out',
                  gap: '0.75rem',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {/* Status icon */}
                <div style={{ marginTop: '2px', flexShrink: 0 }}>
                  {statusIcons[pr.status] || <GitPullRequest size={15} strokeWidth={1.75} style={{ color: 'var(--color-ink-3)' }} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pr.title}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-4)', flexShrink: 0 }}>
                      #{pr.number}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-accent-dim)' }}>
                      <span>{pr.sourceBranch?.name || pr.sourceBranch}</span>
                      <ArrowRight size={10} strokeWidth={1.75} />
                      <span>{pr.targetBranch?.name || pr.targetBranch}</span>
                    </span>
                    <span>·</span>
                    <span>by {pr.author?.username || 'unknown'}</span>
                    <span>·</span>
                    <span>{new Date(pr.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PullRequests;
