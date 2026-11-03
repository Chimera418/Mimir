import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GitBranch, Plus, Trash2, Shield, ShieldOff, Loader2, AlertCircle, X } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const Branches = () => {
  const { owner, name } = useParams();
  const { user } = useAuthStore();
  const [branches, setBranches] = useState([]);
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/repos/${owner}/${name}/branches`);
      const data = res.data.data;
      const list = data.branches || data || [];
      setBranches(list);
      const def = list.find(b => b.isDefault);
      if (def) { setDefaultBranch(def.name); setFromBranch(def.name); }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, [owner, name]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionError("");
    if (!newBranchName.trim()) return;
    setCreating(true);
    try {
      await api.post(`/repos/${owner}/${name}/branches`, { name: newBranchName.trim(), fromBranch });
      setNewBranchName("");
      setShowCreate(false);
      await fetchBranches();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to create branch");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (branchName) => {
    if (!window.confirm(`Delete branch "${branchName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/repos/${owner}/${name}/branches/${branchName}`);
      setBranches(prev => prev.filter(b => b.name !== branchName));
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to delete branch");
    }
  };

  const handleToggleProtect = async (branchName) => {
    try {
      await api.put(`/repos/${owner}/${name}/branches/${branchName}/protect`);
      setBranches(prev => prev.map(b => b.name === branchName ? { ...b, isProtected: !b.isProtected } : b));
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to update protection");
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="branches" />

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
          {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
        </p>

        {user && (
          <button
            onClick={() => { setShowCreate(v => !v); setActionError(""); }}
            className="btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            <Plus size={14} strokeWidth={2} /> New branch
          </button>
        )}
      </div>

      {(error || actionError) && (
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
          <AlertCircle size={14} strokeWidth={1.75} /> {error || actionError}
        </div>
      )}

      {/* Create Branch Panel */}
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
              Create a new branch
            </h3>
            <button
              onClick={() => setShowCreate(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-3)', padding: '2px' }}
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                  Branch name *
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  placeholder="feature/my-branch"
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                  From branch
                </label>
                <select
                  value={fromBranch}
                  onChange={e => setFromBranch(e.target.value)}
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                >
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
                {creating ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : 'Create branch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branches List Container */}
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
            <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading branches…
          </div>
        ) : branches.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--color-ink-3)' }}>
            <GitBranch size={24} strokeWidth={1.25} style={{ margin: '0 auto 0.75rem', color: 'var(--color-ink-4)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
              No branches found
            </p>
          </div>
        ) : (
          <div>
            {branches.map((branch, idx) => (
              <div
                key={branch._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderBottom: idx === branches.length - 1 ? 'none' : '1px solid var(--color-border)',
                  transition: 'background-color 150ms ease-out',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <GitBranch
                    size={14}
                    strokeWidth={1.75}
                    style={{ color: branch.isProtected ? 'var(--color-warning)' : 'var(--color-ink-3)' }}
                  />
                  <Link
                    to={`/${owner}/${name}/commits/${branch.name}`}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'var(--color-ink)',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink)'}
                  >
                    {branch.name}
                  </Link>

                  {branch.name === defaultBranch && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        padding: '1px 5px',
                        border: '1px solid var(--color-border)',
                        borderRadius: '3px',
                        color: 'var(--color-ink-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      default
                    </span>
                  )}

                  {branch.isProtected && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        padding: '1px 5px',
                        border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)',
                        borderRadius: '3px',
                        color: 'var(--color-warning)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <Shield size={9} strokeWidth={2} /> protected
                    </span>
                  )}
                </div>

                {user && branch.name !== defaultBranch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <button
                      onClick={() => handleToggleProtect(branch.name)}
                      className="btn-ghost"
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        color: branch.isProtected ? 'var(--color-warning)' : 'var(--color-ink-3)',
                      }}
                      title={branch.isProtected ? "Unprotect branch" : "Protect branch"}
                    >
                      {branch.isProtected ? <ShieldOff size={11} strokeWidth={1.75} /> : <Shield size={11} strokeWidth={1.75} />}
                      {branch.isProtected ? 'Unprotect' : 'Protect'}
                    </button>
                    <button
                      onClick={() => handleDelete(branch.name)}
                      className="btn-ghost"
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-danger)',
                        borderColor: 'color-mix(in oklch, var(--color-danger) 25%, transparent)',
                      }}
                      title="Delete branch"
                    >
                      <Trash2 size={11} strokeWidth={1.75} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Branches;
