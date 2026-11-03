import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Tag, Plus, Loader2, AlertCircle, Package, X } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const Releases = () => {
  const { owner, name } = useParams();
  const { user } = useAuthStore();
  const [releases, setReleases] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ tagName: "", name: "", body: "", isDraft: false, isPrerelease: false });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [relRes, tagRes] = await Promise.all([
        api.get(`/repos/${owner}/${name}/releases`),
        api.get(`/repos/${owner}/${name}/tags`),
      ]);
      const relData = relRes.data.data;
      setReleases(Array.isArray(relData) ? relData : relData.items || []);
      const tagData = tagRes.data.data;
      setTags(Array.isArray(tagData) ? tagData : tagData.tags || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load releases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [owner, name]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (!form.tagName || !form.name.trim()) { setCreateError("Tag and release title are required"); return; }
    setCreating(true);
    try {
      await api.post(`/repos/${owner}/${name}/releases`, form);
      setShowCreate(false);
      setForm({ tagName: "", name: "", body: "", isDraft: false, isPrerelease: false });
      await fetchData();
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create release");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="releases" />

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
          {releases.length} {releases.length === 1 ? 'release' : 'releases'}
        </p>

        {user && tags.length > 0 && (
          <button
            onClick={() => { setShowCreate(v => !v); setCreateError(""); }}
            className="btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            <Plus size={14} strokeWidth={2} /> New release
          </button>
        )}
      </div>

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

      {/* Create Release Modal/Panel */}
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
              Draft a new release
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
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                  Tag *
                </label>
                <select
                  value={form.tagName}
                  onChange={e => setForm({ ...form, tagName: e.target.value })}
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  required
                >
                  <option value="">Select a tag</option>
                  {tags.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                  Release title *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="v1.0.0 — Initial Release"
                  className="input"
                  required
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.25rem' }}>
                Release notes (Markdown)
              </label>
              <textarea
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                rows={5}
                placeholder="Describe this release…"
                className="input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                <input
                  type="checkbox"
                  checked={form.isDraft}
                  onChange={e => setForm({ ...form, isDraft: e.target.checked })}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                Save as draft
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                <input
                  type="checkbox"
                  checked={form.isPrerelease}
                  onChange={e => setForm({ ...form, isPrerelease: e.target.checked })}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                Pre-release
              </label>
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
                {creating ? <><Loader2 size={13} className="animate-spin" /> Publishing…</> : 'Publish release'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Releases List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading releases…
        </div>
      ) : releases.length === 0 ? (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-surface-1)',
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--color-ink-3)',
          }}
        >
          <Package size={28} strokeWidth={1.25} style={{ margin: '0 auto 0.75rem', color: 'var(--color-ink-4)' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
            No releases yet
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
            {tags.length === 0 ? 'Create a tag first before publishing a release.' : 'Publish your first release for this repository.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {releases.map(r => (
            <div
              key={r._id}
              style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                    {r.name}
                  </h3>
                  {r.isDraft && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', padding: '1px 5px', border: '1px solid var(--color-border)', borderRadius: '3px', color: 'var(--color-ink-4)', textTransform: 'uppercase' }}>
                      Draft
                    </span>
                  )}
                  {r.isPrerelease && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', padding: '1px 5px', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)', borderRadius: '3px', color: 'var(--color-warning)', textTransform: 'uppercase' }}>
                      Pre-release
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-4)' }}>
                  {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginBottom: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-accent-dim)' }}>
                  <Tag size={11} strokeWidth={1.75} /> {r.tag?.name}
                </span>
                <span>·</span>
                <span>by {r.author?.username}</span>
              </div>

              {r.body && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', color: 'var(--color-ink-2)', fontSize: '0.8125rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {r.body}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Releases;
