import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  GitBranch, Folder, File as FileIcon, Clock, HardDrive,
  AlertCircle, Plus, X, Upload, GitCommit, ChevronDown,
  Loader2, CheckCircle2,
} from 'lucide-react';
import useRepoStore from '../store/repoStore';
import RepoHeader from '../components/RepoHeader';

/* ─── Shared token shortcuts ─────────────────────────────────── */
const T = {
  surface1: 'var(--color-surface-1)',
  surface2: 'var(--color-surface-2)',
  border:   'var(--color-border)',
  ink:      'var(--color-ink)',
  ink2:     'var(--color-ink-2)',
  ink3:     'var(--color-ink-3)',
  ink4:     'var(--color-ink-4)',
  accent:   'var(--color-accent)',
  accentDim:'var(--color-accent-dim)',
  accentBg: 'var(--color-accent-bg)',
  mono:     'var(--font-mono)',
  sans:     'var(--font-sans)',
};

/* ─── File Tree Node ─────────────────────────────────────────── */
const FileTreeNode = ({ name, node, owner, repoName, branch }) => {
  const [open, setOpen] = useState(true);

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '0.5rem 0.875rem',
            background: 'none',
            border: 'none',
            borderBottom: `1px solid ${T.border}`,
            cursor: 'pointer',
            color: T.ink2,
            fontSize: '0.8125rem',
            textAlign: 'left',
            transition: 'color 150ms ease-out, background-color 150ms ease-out',
            gap: '0.5rem',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = T.ink;
            e.currentTarget.style.backgroundColor = T.surface2;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = T.ink2;
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ChevronDown
            size={12}
            strokeWidth={2}
            style={{
              color: T.ink4,
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 150ms ease-out',
              flexShrink: 0,
            }}
          />
          <Folder size={14} strokeWidth={1.5} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <span style={{ fontFamily: T.mono, fontWeight: 500 }}>{name}</span>
        </button>
        {open && (
          <div style={{ paddingLeft: '1.25rem', borderLeft: `1px solid ${T.border}`, marginLeft: '1.125rem' }}>
            {Object.entries(node.children).map(([childName, childNode]) => (
              <FileTreeNode
                key={childName}
                name={childName}
                node={childNode}
                owner={owner}
                repoName={repoName}
                branch={branch}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ borderBottom: `1px solid ${T.border}` }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = T.surface2}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <Link
        to={`/${owner}/${repoName}/blob/${branch}/${node.path}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.875rem',
          textDecoration: 'none',
          color: T.ink2,
          fontSize: '0.8125rem',
          transition: 'color 150ms ease-out',
          gap: '0.5rem',
        }}
        onMouseEnter={e => e.currentTarget.style.color = T.accent}
        onMouseLeave={e => e.currentTarget.style.color = T.ink2}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
          <FileIcon size={14} strokeWidth={1.5} style={{ color: T.ink4, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: T.mono,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontFamily: T.mono,
            fontSize: '0.6875rem',
            color: T.ink4,
            flexShrink: 0,
          }}
        >
          <HardDrive size={10} strokeWidth={1.5} />
          {(node.size / 1024).toFixed(2)} KB
        </span>
      </Link>
    </div>
  );
};

/* ─── Commit Modal ───────────────────────────────────────────── */
const CommitModal = ({ owner, repoName, branch, onClose, onSuccess }) => {
  const { createCommit } = useRepoStore();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([{ path: '', content: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const updateFile = (idx, field, value) =>
    setFiles(fs => fs.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  const addBlankFile = () => setFiles(fs => [...fs, { path: '', content: '', status: 'modified' }]);
  const removeFile = (idx) => setFiles(fs => fs.filter((_, i) => i !== idx));

  const handleUpload = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setFiles(fs => [...fs, { path: file.name, content: ev.target.result, status: 'modified' }]);
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!message.trim()) { setError('Commit message is required'); return; }
    const validFiles = files.filter(f => f.path.trim() && (f.content.trim() || f.status === 'deleted'));
    if (validFiles.length === 0) { setError('At least one file with a path is required'); return; }
    setSubmitting(true);
    const result = await createCommit(owner, repoName, branch, message.trim(), validFiles);
    setSubmitting(false);
    if (result.success) { onSuccess(); } else { setError(result.error); }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.72)',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: T.surface1,
          border: `1px solid ${T.border}`,
          borderRadius: '6px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1.25rem',
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <GitCommit size={15} strokeWidth={1.75} style={{ color: T.accent }} />
            <div>
              <p style={{ fontFamily: T.mono, fontSize: '0.875rem', fontWeight: 600, color: T.ink }}>
                Create commit
              </p>
              <p style={{ fontFamily: T.mono, fontSize: '0.6875rem', color: T.ink3, marginTop: '1px' }}>
                <GitBranch size={10} strokeWidth={1.5} style={{ display: 'inline', marginRight: '3px' }} />
                {branch}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.ink3, padding: '4px', borderRadius: '4px',
              transition: 'color 150ms ease-out',
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.ink}
            onMouseLeave={e => e.currentTarget.style.color = T.ink3}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Message */}
            <div>
              <label
                htmlFor="commit-msg"
                style={{ display: 'block', fontFamily: T.mono, fontSize: '0.8125rem', fontWeight: 500, color: T.ink2, marginBottom: '0.375rem' }}
              >
                Commit message <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="commit-msg"
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="input"
                placeholder="e.g. Add initial project structure"
              />
            </div>

            {/* Files */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <label style={{ fontFamily: T.mono, fontSize: '0.8125rem', fontWeight: 500, color: T.ink2 }}>
                  Files <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.3125rem 0.625rem' }}
                  >
                    <Upload size={12} strokeWidth={1.75} /> Upload
                  </button>
                  <button
                    type="button"
                    onClick={addBlankFile}
                    className="btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.3125rem 0.625rem', color: T.accent, borderColor: T.accentDim }}
                  >
                    <Plus size={12} strokeWidth={2} /> Add file
                  </button>
                </div>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: `1px solid ${T.border}`,
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--color-base)',
                    }}
                  >
                    {/* File header bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.375rem 0.625rem',
                        borderBottom: `1px solid ${T.border}`,
                        backgroundColor: T.surface1,
                      }}
                    >
                      <FileIcon size={12} strokeWidth={1.5} style={{ color: T.ink4, flexShrink: 0 }} />
                      <input
                        type="text"
                        value={file.path}
                        onChange={e => updateFile(idx, 'path', e.target.value)}
                        placeholder="path/to/file.txt"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontFamily: T.mono,
                          fontSize: '0.75rem',
                          color: T.ink,
                        }}
                      />
                      <label
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--color-danger)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <input
                          type="checkbox"
                          checked={file.status === 'deleted'}
                          onChange={e => updateFile(idx, 'status', e.target.checked ? 'deleted' : 'modified')}
                          style={{ accentColor: 'var(--color-danger)', width: '12px', height: '12px' }}
                        />
                        Delete
                      </label>
                      {files.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: T.ink4, padding: '2px',
                            transition: 'color 150ms ease-out', flexShrink: 0,
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = T.ink4}
                        >
                          <X size={13} strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                    {file.status !== 'deleted' && (
                      <textarea
                        rows={5}
                        value={file.content}
                        onChange={e => updateFile(idx, 'content', e.target.value)}
                        placeholder="File content…"
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontFamily: T.mono,
                          fontSize: '0.75rem',
                          color: T.ink2,
                          padding: '0.5rem 0.75rem',
                          resize: 'vertical',
                          display: 'block',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--color-danger-bg)',
                  border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
                  borderRadius: '4px',
                  color: 'var(--color-danger)',
                  fontSize: '0.8125rem',
                }}
              >
                <AlertCircle size={13} strokeWidth={1.75} /> {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.625rem',
              padding: '0.875rem 1.25rem',
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <button type="button" onClick={onClose} className="btn-ghost" style={{ fontSize: '0.8125rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ fontSize: '0.8125rem' }}
            >
              {submitting
                ? <><Loader2 size={13} className="animate-spin" /> Committing…</>
                : <><CheckCircle2 size={13} strokeWidth={2} /> Create commit</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Repository View ────────────────────────────────────────── */
const RepositoryView = () => {
  const { owner, name } = useParams();
  const { currentRepo, currentBranch, branches, fileTree, fetchRepoDetails, fetchFileTree, isLoading, error } = useRepoStore();
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [activeBranch, setActiveBranch] = useState(null);
  const [branchDropdown, setBranchDropdown] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    fetchRepoDetails(owner, name);
  }, [owner, name, fetchRepoDetails]);

  useEffect(() => {
    if (currentRepo && currentBranch) {
      setActiveBranch(currentBranch);
      fetchFileTree(owner, name, currentBranch);
    }
  }, [currentRepo, currentBranch, owner, name, fetchFileTree]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBranchDropdown(false);
      }
    };
    if (branchDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [branchDropdown]);

  const switchBranch = (branchName) => {
    setActiveBranch(branchName);
    fetchFileTree(owner, name, branchName);
    setBranchDropdown(false);
  };

  const handleCommitSuccess = () => {
    setShowCommitModal(false);
    fetchFileTree(owner, name, activeBranch || currentBranch);
  };

  if (isLoading && !currentRepo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '0.75rem', color: T.ink4, fontSize: '0.875rem' }}>
        <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
        Loading repository…
      </div>
    );
  }

  if (error || !currentRepo) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.875rem',
            padding: '1.25rem',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
            borderRadius: '6px',
            color: 'var(--color-danger)',
          }}
        >
          <AlertCircle size={18} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontFamily: T.mono, fontWeight: 600, marginBottom: '0.25rem' }}>Repository not found</p>
            <p style={{ fontSize: '0.8125rem', opacity: 0.85 }}>{error || 'This repository does not exist or you do not have access.'}</p>
            <Link to="/dashboard" style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', textDecoration: 'underline', textUnderlineOffset: '2px', display: 'inline-block', marginTop: '0.75rem' }}>
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayBranch = activeBranch || currentBranch;

  return (
    <>
      {showCommitModal && (
        <CommitModal
          owner={owner}
          repoName={name}
          branch={displayBranch}
          onClose={() => setShowCommitModal(false)}
          onSuccess={handleCommitSuccess}
        />
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <RepoHeader owner={owner} name={name} activeTab="code" />

        {/* ── Controls row ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Branch selector */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setBranchDropdown(o => !o)}
              className="btn-ghost"
              style={{ fontSize: '0.8125rem', minWidth: '140px' }}
            >
              <GitBranch size={13} strokeWidth={1.75} />
              <span style={{ fontFamily: T.mono }}>{displayBranch}</span>
              <ChevronDown
                size={12}
                strokeWidth={2}
                style={{
                  marginLeft: 'auto',
                  transition: 'transform 150ms ease-out',
                  transform: branchDropdown ? 'rotate(180deg)' : 'rotate(0)',
                }}
              />
            </button>

            {branchDropdown && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 'calc(100% + 4px)',
                  width: '220px',
                  backgroundColor: T.surface1,
                  border: `1px solid ${T.border}`,
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 20,
                  overflow: 'hidden',
                }}
              >
                <p style={{ fontFamily: T.mono, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3, padding: '0.5rem 0.75rem', borderBottom: `1px solid ${T.border}` }}>
                  Branches
                </p>
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {branches.map(b => (
                    <button
                      key={b._id}
                      onClick={() => switchBranch(b.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: T.mono,
                        fontSize: '0.8125rem',
                        color: b.name === displayBranch ? T.accent : T.ink2,
                        textAlign: 'left',
                        transition: 'background-color 150ms ease-out',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = T.surface2}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <GitBranch size={11} strokeWidth={1.75} />
                        {b.name}
                      </span>
                      {b.isDefault && (
                        <span style={{ fontSize: '0.625rem', padding: '1px 5px', border: `1px solid ${T.border}`, borderRadius: '3px', color: T.ink4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          default
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to={`/${owner}/${name}/commits/${displayBranch}`} className="btn-ghost" style={{ fontSize: '0.8125rem' }}>
              <Clock size={13} strokeWidth={1.75} /> History
            </Link>
            <Link to={`/${owner}/${name}/network`} className="btn-ghost" style={{ fontSize: '0.8125rem' }}>
              <GitBranch size={13} strokeWidth={1.75} /> Network
            </Link>
            <button
              onClick={() => setShowCommitModal(true)}
              className="btn-primary"
              style={{ fontSize: '0.8125rem' }}
            >
              <Plus size={14} strokeWidth={2} /> Add files
            </button>
          </div>
        </div>

        {/* ── File browser ─────────────────────────────────── */}
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: T.surface1,
          }}
        >
          {/* Browser header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.625rem 0.875rem',
              borderBottom: `1px solid ${T.border}`,
              backgroundColor: 'var(--color-base)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img
                src={currentRepo.owner?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${owner}`}
                alt={owner}
                style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1px solid ${T.border}` }}
              />
              <span style={{ fontFamily: T.mono, fontSize: '0.75rem', color: T.ink2, fontWeight: 500 }}>{owner}</span>
            </div>
            <span style={{ fontFamily: T.mono, fontSize: '0.6875rem', color: T.ink4 }}>latest commit</span>
          </div>

          {/* File tree */}
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.75rem', color: T.ink4, fontSize: '0.875rem' }}>
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin" />
              Loading files…
            </div>
          ) : !fileTree || Object.keys(fileTree).length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <Folder size={28} strokeWidth={1.25} style={{ color: T.ink4, margin: '0 auto 1rem' }} />
              <p style={{ fontFamily: T.mono, fontSize: '0.9375rem', fontWeight: 600, color: T.ink, marginBottom: '0.375rem' }}>
                This repository is empty.
              </p>
              <p style={{ fontSize: '0.8125rem', color: T.ink3, marginBottom: '1.5rem' }}>
                Get started by committing your first files.
              </p>
              <button
                onClick={() => setShowCommitModal(true)}
                className="btn-primary"
                style={{ fontSize: '0.8125rem' }}
              >
                <Plus size={14} strokeWidth={2} /> Add first files
              </button>
            </div>
          ) : (
            Object.entries(fileTree).map(([nodeName, node]) => (
              <FileTreeNode
                key={nodeName}
                name={nodeName}
                node={node}
                owner={owner}
                repoName={name}
                branch={displayBranch}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default RepositoryView;
