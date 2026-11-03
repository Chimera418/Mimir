import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AlertCircle, Plus, Loader2, CheckCircle2, Circle, X } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const Issues = () => {
  const { owner, name } = useParams();
  const { user } = useAuthStore();
  const [issues, setIssues] = useState([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchIssues = async (s) => {
    try {
      setLoading(true);
      const res = await api.get(`/repos/${owner}/${name}/issues?status=${s}&limit=50`);
      const data = res.data.data;
      setIssues(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues(status);
  }, [owner, name, status]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!form.title.trim()) { setCreateError("Title is required"); return; }
    setCreating(true);
    try {
      await api.post(`/repos/${owner}/${name}/issues`, form);
      setShowCreate(false);
      setForm({ title: "", body: "" });
      await fetchIssues(status);
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create issue");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="issues" />

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Status filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {["open", "closed", "all"].map(s => {
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
            <Plus size={14} strokeWidth={2} /> New issue
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

      {/* Create Issue Panel */}
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
              New issue
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
              placeholder="Leave a comment (markdown supported)…"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="input"
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
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
                {creating ? <><Loader2 size={13} className="animate-spin" /> Submitting…</> : 'Submit new issue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Issues list container */}
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
            <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading issues…
          </div>
        ) : issues.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--color-ink-3)' }}>
            <Circle size={24} strokeWidth={1.25} style={{ margin: '0 auto 0.75rem', color: 'var(--color-ink-4)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
              No {status === "all" ? "" : status} issues
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
              There aren't any {status === "all" ? "" : status} issues in this repository.
            </p>
          </div>
        ) : (
          <div>
            {issues.map((issue, idx) => (
              <Link
                key={issue._id}
                to={`/${owner}/${name}/issues/${issue.number}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '0.875rem 1rem',
                  borderBottom: idx === issues.length - 1 ? 'none' : '1px solid var(--color-border)',
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
                  {issue.status === "closed" ? (
                    <CheckCircle2 size={15} strokeWidth={1.75} style={{ color: 'var(--color-ink-4)' }} />
                  ) : (
                    <Circle size={15} strokeWidth={2} style={{ color: 'var(--color-success)' }} />
                  )}
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
                      {issue.title}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-4)', flexShrink: 0 }}>
                      #{issue.number}
                    </span>
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                    by {issue.author?.username || 'unknown'} · {new Date(issue.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {issue.assignees?.length > 0 && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--color-ink-4)' }}>
                        · assigned to {issue.assignees.map(a => a.username).join(", ")}
                      </span>
                    )}
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

export default Issues;
