import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  GitCommit, 
  ArrowLeft, 
  Copy, 
  Check, 
  Clock, 
  User, 
  FileText, 
  GitBranch, 
  FolderTree, 
  Loader2, 
  AlertCircle,
  RotateCcw,
  X,
  Sparkles,
  MessageSquare,
  Send,
  MessageCircle
} from "lucide-react";
import api from "../services/api";

const CommitDetail = () => {
  const { owner, name, sha } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedMerkle, setCopiedMerkle] = useState(false);

  // Version recovery / Revert state
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [reverting, setReverting] = useState(false);
  const [revertResult, setRevertResult] = useState(null);
  const [revertError, setRevertError] = useState("");

  // Commit Annotations State (Standalone code discussion without PR)
  const [annotations, setAnnotations] = useState([]);
  const [annotationBody, setAnnotationBody] = useState("");
  const [annotationFile, setAnnotationFile] = useState("");
  const [submittingAnnotation, setSubmittingAnnotation] = useState(false);
  const [annotationError, setAnnotationError] = useState("");

  const fetchAnnotations = async () => {
    try {
      const res = await api.get(`/repos/${owner}/${name}/commits/${sha}/annotations`);
      setAnnotations(res.data.data?.annotations || []);
    } catch {
      // Non-critical
    }
  };

  const handleAddAnnotation = async (e) => {
    e.preventDefault();
    if (!annotationBody.trim()) return;
    try {
      setSubmittingAnnotation(true);
      setAnnotationError("");
      const res = await api.post(`/repos/${owner}/${name}/commits/${sha}/annotations`, {
        body: annotationBody.trim(),
        filePath: annotationFile || undefined,
      });
      setAnnotations((prev) => [...prev, res.data.data?.annotation]);
      setAnnotationBody("");
      setAnnotationFile("");
    } catch (err) {
      setAnnotationError(err.response?.data?.message || "Failed to add annotation");
    } finally {
      setSubmittingAnnotation(false);
    }
  };

  useEffect(() => {
    const fetchCommit = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/repos/${owner}/${name}/commits/${sha}`);
        setData(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load commit details");
      } finally {
        setLoading(false);
      }
    };

    fetchCommit();
    fetchAnnotations();
  }, [owner, name, sha]);

  const handleRevert = async (targetBranch) => {
    try {
      setReverting(true);
      setRevertError("");
      const res = await api.post(`/repos/${owner}/${name}/commits/${sha}/revert`, {
        branchName: targetBranch || branchName,
        reason: revertReason,
      });
      setRevertResult(res.data.data);
    } catch (err) {
      setRevertError(err.response?.data?.message || "Failed to revert commit");
    } finally {
      setReverting(false);
    }
  };

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-gray-400">
        <Loader2 size={36} className="animate-spin text-accent mb-4" />
        <p className="text-sm font-medium">Loading commit details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg">Error loading commit</h3>
            <p className="text-sm mt-1">{error || "Commit not found"}</p>
            <Link
              to={`/${owner}/${name}`}
              className="inline-block mt-4 text-sm font-medium text-white underline hover:text-accent"
            >
              Back to repository
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { commit, fileVersions = [] } = data;
  const messageLines = (commit.message || "").split("\n");
  const title = messageLines[0];
  const description = messageLines.slice(1).join("\n").trim();
  const branchName = commit.branch?.name || "main";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Revert Modal */}
      {showRevertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-dark-700 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <RotateCcw size={18} className="text-amber-400" />
                Revert Commit: {sha.slice(0, 8)}
              </div>
              <button
                onClick={() => setShowRevertModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {revertResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <Check size={16} /> Version Recovery Successful!
                  </div>
                  <p className="text-gray-300 text-xs">
                    Created new forward-moving recovery commit{' '}
                    <span className="font-mono text-accent">{revertResult.revertCommit.sha.slice(0, 8)}</span>{' '}
                    reversing target changes without altering historical DAG commits.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Link
                    to={`/${owner}/${name}/commit/${revertResult.revertCommit.sha}`}
                    className="bg-accent text-dark-900 font-semibold px-4 py-2 rounded-lg text-xs"
                  >
                    View Revert Commit
                  </Link>
                  <button
                    onClick={() => setShowRevertModal(false)}
                    className="bg-dark-800 text-gray-300 border border-dark-700 px-4 py-2 rounded-lg text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-300 text-sm leading-relaxed">
                  Reverting this commit will compute an inverse delta against its parent and create a brand-new commit on branch{' '}
                  <span className="font-mono text-accent">{branchName}</span>. Historical commits remain permanently preserved in MongoDB.
                </p>

                {revertError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    {revertError}
                  </div>
                )}

                <div>
                  <label className="block text-gray-400 text-xs mb-1">Optional Reason for Reversion:</label>
                  <input
                    type="text"
                    placeholder="e.g., Buggy auth middleware, regressing login"
                    value={revertReason}
                    onChange={(e) => setRevertReason(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowRevertModal(false)}
                    className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white border border-dark-700 hover:bg-dark-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevert(branchName)}
                    disabled={reverting}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
                  >
                    {reverting && <Loader2 size={13} className="animate-spin" />}
                    {reverting ? 'Reverting...' : 'Confirm Revert'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to={`/${owner}/${name}`} className="hover:text-white transition">
          {owner} / {name}
        </Link>
        <span>/</span>
        <Link to={`/${owner}/${name}/commits/${branchName}`} className="hover:text-white transition">
          commits
        </Link>
        <span>/</span>
        <span className="text-gray-200 font-mono text-xs">{sha.substring(0, 7)}</span>
      </div>

      {/* Main Commit Card */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden shadow-lg mb-8">
        {/* Card Header */}
        <div className="p-6 border-b border-dark-700 bg-dark-800/80">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">
                {title}
              </h1>
              {description && (
                <p className="mt-3 text-gray-300 text-sm whitespace-pre-line leading-relaxed bg-dark-900/60 p-3 rounded-lg border border-dark-700">
                  {description}
                </p>
              )}
            </div>

            {/* Actions: Revert Button & SHA Copy Badge */}
            <div className="flex items-center gap-3 self-start flex-wrap">
              <button
                onClick={() => {
                  setRevertResult(null);
                  setRevertError("");
                  setShowRevertModal(true);
                }}
                className="flex items-center gap-1.5 bg-dark-900 hover:bg-dark-700 text-gray-300 hover:text-white border border-dark-700 hover:border-gray-500 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <RotateCcw size={13} className="text-amber-400" />
                <span>Revert Commit</span>
              </button>

              <div className="flex items-center gap-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5">
                <span className="font-mono text-xs text-accent">{sha.substring(0, 10)}</span>
                <button
                  onClick={() => copyToClipboard(sha, setCopiedSha)}
                  className="text-gray-400 hover:text-white transition p-1"
                  title="Copy full SHA"
                >
                  {copiedSha ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-dark-700/60 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <img
                src={
                  commit.author?.avatar ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${commit.author?.username || "unknown"}`
                }
                alt="author"
                className="w-5 h-5 rounded-full"
              />
              <span className="text-gray-200 font-medium">
                {commit.author?.username || "Unknown Author"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>committed on {new Date(commit.createdAt).toLocaleString()}</span>
            </div>

            {commit.branch && (
              <div className="flex items-center gap-1.5 bg-dark-700/50 px-2 py-0.5 rounded text-gray-300">
                <GitBranch size={13} />
                <span>{branchName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Technical Details: Parents & Merkle Root */}
        <div className="p-6 bg-dark-900/40 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-dark-900/80 p-3 rounded-lg border border-dark-700/60">
            <span className="text-gray-500 block mb-1 uppercase tracking-wider font-sans font-semibold">
              Parent Commits
            </span>
            {commit.parentCommits && commit.parentCommits.length > 0 ? (
              <div className="space-y-1 mt-1">
                {commit.parentCommits.map((parent) => (
                  <div key={parent._id || parent.sha} className="flex items-center justify-between">
                    <Link
                      to={`/${owner}/${name}/commit/${parent.sha}`}
                      className="text-accent hover:underline flex items-center gap-1"
                    >
                      <GitCommit size={12} />
                      <span>{parent.sha.substring(0, 10)}</span>
                    </Link>
                    <span className="text-gray-400 font-sans truncate max-w-[200px]">
                      {parent.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-gray-500 font-sans italic">None (Root commit)</span>
            )}
          </div>

          <div className="bg-dark-900/80 p-3 rounded-lg border border-dark-700/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 uppercase tracking-wider font-sans font-semibold">
                Merkle Tree Root Hash
              </span>
              <button
                onClick={() => copyToClipboard(commit.merkleRoot, setCopiedMerkle)}
                className="text-gray-400 hover:text-white transition"
                title="Copy Merkle Root"
              >
                {copiedMerkle ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
            <p className="text-gray-300 break-all text-[11px] leading-relaxed">
              {commit.merkleRoot || "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Files Changed Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderTree size={18} className="text-accent" />
            <span>Changed Files</span>
            <span className="text-xs bg-dark-800 border border-dark-700 text-gray-400 px-2 py-0.5 rounded-full">
              {fileVersions.length}
            </span>
          </h2>
        </div>

        {fileVersions.length === 0 ? (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No individual file change records attached to this commit.</p>
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl divide-y divide-dark-700 overflow-hidden shadow-sm">
            {fileVersions.map((fv) => (
              <div
                key={fv._id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-dark-750 transition"
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-gray-400 flex-shrink-0" />
                  <Link
                    to={`/${owner}/${name}/blob/${branchName}/${fv.filePath}`}
                    className="text-sm font-medium text-white hover:text-accent transition font-mono"
                  >
                    {fv.filePath}
                  </Link>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                  <span>{formatBytes(fv.fileSize)}</span>
                  <span className="bg-dark-900 border border-dark-700 px-2 py-0.5 rounded text-gray-500">
                    hash: {fv.contentHash?.substring(0, 10)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standalone Commit Discussion / Annotations (Outside PRs) */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={16} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
            <span>Commit Annotations & Discussion</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '2px 7px', borderRadius: '10px', backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-ink-3)' }}>
              {annotations.length}
            </span>
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
            PR-independent discussion
          </span>
        </div>

        {/* Existing Annotations List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {annotations.length === 0 ? (
            <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', textAlign: 'center', color: 'var(--color-ink-4)', fontSize: '0.8125rem' }}>
              No annotations yet. Leave a note or post-merge review comment on this commit.
            </div>
          ) : (
            annotations.map((ann) => (
              <div
                key={ann._id}
                style={{
                  backgroundColor: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-ink)' }}>
                      {ann.author?.username || 'Unknown'}
                    </span>
                    {ann.filePath && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', padding: '1px 6px', borderRadius: '3px', backgroundColor: 'var(--color-base)', border: '1px solid var(--color-border)', color: 'var(--color-accent)' }}>
                        file: {ann.filePath}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                    {new Date(ann.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {ann.body}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add Annotation Form */}
        <form
          onSubmit={handleAddAnnotation}
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '1rem 1.25rem',
          }}
        >
          {annotationError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              {annotationError}
            </div>
          )}

          <div style={{ marginBottom: '0.75rem' }}>
            <textarea
              rows={3}
              value={annotationBody}
              onChange={(e) => setAnnotationBody(e.target.value)}
              placeholder="Leave an annotation, code note, or post-merge review on this commit..."
              className="input"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                Target file (optional):
              </span>
              <select
                value={annotationFile}
                onChange={(e) => setAnnotationFile(e.target.value)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  padding: '3px 8px',
                  backgroundColor: 'var(--color-base)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  color: 'var(--color-ink-2)',
                }}
              >
                <option value="">General commit comment</option>
                {fileVersions.map((fv) => (
                  <option key={fv.filePath} value={fv.filePath}>
                    {fv.filePath}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingAnnotation || !annotationBody.trim()}
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.375rem 0.875rem' }}
            >
              {submittingAnnotation ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={1.75} />}
              <span>{submittingAnnotation ? 'Posting…' : 'Add Annotation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommitDetail;
