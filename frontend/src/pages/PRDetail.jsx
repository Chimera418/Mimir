import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { GitPullRequest, GitMerge, X, Loader2, ArrowLeft, AlertCircle, MessageSquare, Send, ShieldAlert, FileCode, CheckCircle2, ArrowRight } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const PRDetail = () => {
  const { owner, name, prNumber } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [pr, setPr] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [merging, setMerging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Conflict detection & resolution state
  const [conflictData, setConflictData] = useState(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [resolvingConflicts, setResolvingConflicts] = useState(false);
  const [resolutionDrafts, setResolutionDrafts] = useState({});
  const [showConflictEditor, setShowConflictEditor] = useState(false);

  const checkConflicts = async () => {
    try {
      setCheckingConflicts(true);
      const res = await api.get(`/repos/${owner}/${name}/pulls/${prNumber}/conflicts`);
      const data = res.data.data;
      setConflictData(data);
      if (data?.conflicts?.length > 0) {
        const drafts = {};
        data.conflicts.forEach((c) => {
          drafts[c.filePath] = c.conflictContent;
        });
        setResolutionDrafts(drafts);
      }
    } catch {
      // ignore
    } finally {
      setCheckingConflicts(false);
    }
  };

  const fetchPR = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/repos/${owner}/${name}/pulls/${prNumber}`);
      const data = res.data.data;
      setPr(data.pr);
      setComments(data.comments || []);
      if (data.pr?.status === 'open') {
        checkConflicts();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load pull request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPR(); }, [owner, name, prNumber]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.post(`/repos/${owner}/${name}/pulls/${prNumber}/comments`, { body: commentBody });
      setComments(prev => [...prev, res.data.data.comment]);
      setCommentBody("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleResolveAndPush = async () => {
    setResolvingConflicts(true);
    setError("");
    try {
      const conflicts = conflictData?.conflicts || [];
      if (conflicts.length === 0) {
        setError("No conflicts detected to resolve.");
        setResolvingConflicts(false);
        return;
      }

      // Check for remaining conflict markers
      for (const c of conflicts) {
        const resolved = resolutionDrafts[c.filePath] !== undefined ? resolutionDrafts[c.filePath] : c.conflictContent;
        if (resolved && (resolved.includes('<<<<<<<') || resolved.includes('=======') || resolved.includes('>>>>>>>'))) {
          setError(`File '${c.filePath}' still contains unresolved conflict markers ('<<<<<<<', '=======', or '>>>>>>>'). Please clean them up before committing.`);
          setResolvingConflicts(false);
          return;
        }
      }

      const resolutions = conflicts.map((c) => {
        const val = resolutionDrafts[c.filePath] !== undefined ? resolutionDrafts[c.filePath] : (c.conflictContent || '');
        return {
          path: c.filePath,
          filePath: c.filePath,
          resolvedContent: val,
          content: val,
        };
      });

      await api.post(`/repos/${owner}/${name}/pulls/${prNumber}/resolve-conflicts`, { resolutions });
      setShowConflictEditor(false);
      await fetchPR();
      setActionMsg("Conflicts resolved and resolution commit pushed to source branch successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resolve conflicts");
    } finally {
      setResolvingConflicts(false);
    }
  };

  const handleMerge = async () => {
    if (!window.confirm("Merge this pull request?")) return;
    setMerging(true);
    setActionMsg("");
    setError("");
    try {
      let res;
      try {
        res = await api.put(`/repos/${owner}/${name}/pulls/${prNumber}/merge`, { mergeStrategy: "merge" });
      } catch (putErr) {
        if (putErr.response?.status === 404 || putErr.response?.status === 405) {
          res = await api.post(`/repos/${owner}/${name}/pulls/${prNumber}/merge`, { mergeStrategy: "merge" });
        } else {
          throw putErr;
        }
      }
      const commitSha = res.data.data?.mergeCommit?.sha;
      setActionMsg(`Merged successfully! Commit: ${commitSha ? commitSha.slice(0, 7) : ""}`);
      await fetchPR();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to merge pull request";
      setError(errMsg);
    } finally {
      setMerging(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm("Close this pull request?")) return;
    setClosing(true);
    try {
      await api.put(`/repos/${owner}/${name}/pulls/${prNumber}/close`);
      await fetchPR();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to close pull request");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="pulls" />

      {/* Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to={`/${owner}/${name}/pulls`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--color-ink-3)',
            textDecoration: 'none',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-ink)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-ink-3)'}
        >
          <ArrowLeft size={13} strokeWidth={1.75} /> Back to pull requests
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading pull request…
        </div>
      ) : error && !pr ? (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
            borderRadius: '4px',
            color: 'var(--color-danger)',
            fontSize: '0.8125rem',
          }}
        >
          {error}
        </div>
      ) : (
        <div>
          {/* PR Header */}
          <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
                {pr?.title}
              </h1>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', color: 'var(--color-ink-4)', fontWeight: 400 }}>
                #{pr?.number}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '3px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  backgroundColor: pr?.status === 'merged' ? 'color-mix(in oklch, #a78bfa 15%, transparent)' : pr?.status === 'closed' ? 'var(--color-surface-2)' : 'var(--color-success-bg)',
                  color: pr?.status === 'merged' ? '#a78bfa' : pr?.status === 'closed' ? 'var(--color-ink-3)' : 'var(--color-success)',
                  border: `1px solid ${pr?.status === 'merged' ? 'color-mix(in oklch, #a78bfa 30%, transparent)' : pr?.status === 'closed' ? 'var(--color-border)' : 'color-mix(in oklch, var(--color-success) 30%, transparent)'}`,
                }}
              >
                {pr?.status === 'merged' ? <GitMerge size={11} strokeWidth={2} /> : pr?.status === 'closed' ? <X size={11} strokeWidth={2} /> : <GitPullRequest size={11} strokeWidth={2} />}
                {pr?.status}
              </span>

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                {pr?.author?.username} opened on {new Date(pr?.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>

              <span style={{ color: 'var(--color-ink-4)' }}>·</span>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-accent)' }}>
                <span>{pr?.sourceBranch?.name || pr?.sourceBranch}</span>
                <ArrowRight size={11} strokeWidth={1.75} />
                <span>{pr?.targetBranch?.name || pr?.targetBranch}</span>
              </span>
            </div>
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

          {actionMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.875rem',
                backgroundColor: 'var(--color-success-bg)',
                border: '1px solid color-mix(in oklch, var(--color-success) 35%, transparent)',
                borderRadius: '4px',
                color: 'var(--color-success)',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
              }}
            >
              <CheckCircle2 size={14} strokeWidth={1.75} /> {actionMsg}
            </div>
          )}

          {/* 3-Way Merge & Conflict Status Banner */}
          {pr?.status === "open" && conflictData && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '6px',
                border: `1px solid ${conflictData.hasConflicts ? 'color-mix(in oklch, var(--color-warning) 30%, transparent)' : 'color-mix(in oklch, var(--color-success) 30%, transparent)'}`,
                backgroundColor: conflictData.hasConflicts ? 'color-mix(in oklch, var(--color-warning) 8%, transparent)' : 'var(--color-success-bg)',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {conflictData.hasConflicts ? <ShieldAlert size={16} strokeWidth={1.75} style={{ color: 'var(--color-warning)' }} /> : <CheckCircle2 size={16} strokeWidth={1.75} style={{ color: 'var(--color-success)' }} />}
                  <div>
                    <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                      {conflictData.hasConflicts ? 'Merge conflicts detected' : 'Clean 3-way merge ready'}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '2px' }}>
                      {conflictData.hasConflicts
                        ? `${conflictData.conflicts.length} conflicting file(s) between '${pr?.sourceBranch?.name}' and '${pr?.targetBranch?.name}'`
                        : `No conflicting edits with target branch '${pr?.targetBranch?.name}'. Automatic merge is safe.`}
                    </p>
                  </div>
                </div>

                {conflictData.hasConflicts && (
                  <button
                    onClick={() => setShowConflictEditor(!showConflictEditor)}
                    className="btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', color: 'var(--color-warning)', borderColor: 'color-mix(in oklch, var(--color-warning) 30%, transparent)' }}
                  >
                    {showConflictEditor ? 'Hide editor' : 'Resolve conflicts in browser'}
                  </button>
                )}
              </div>

              {/* Inline Conflict Resolver */}
              {showConflictEditor && conflictData.conflicts.length > 0 && (
                <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-2)' }}>
                    Edit the conflicting file(s) below to remove conflict markers (<code style={{ color: 'var(--color-warning)' }}>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code style={{ color: 'var(--color-warning)' }}>=======</code>, <code style={{ color: 'var(--color-warning)' }}>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code>) and keep the desired final state:
                  </p>

                  {conflictData.conflicts.map((c) => {
                    const currentVal = resolutionDrafts[c.filePath] !== undefined ? resolutionDrafts[c.filePath] : (c.conflictContent || '');
                    const hasMarkers = currentVal.includes('<<<<<<<') || currentVal.includes('=======') || currentVal.includes('>>>>>>>');
                    return (
                      <div key={c.filePath} style={{ backgroundColor: 'var(--color-base)', border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0.625rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-1)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{c.filePath}</span>
                            {hasMarkers ? (
                              <span style={{ color: 'var(--color-warning)', fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                ⚠ markers present
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-success)', fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                ✓ clean
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            {c.targetContent !== undefined && (
                              <button
                                type="button"
                                onClick={() => setResolutionDrafts((prev) => ({ ...prev, [c.filePath]: c.targetContent }))}
                                className="btn-ghost"
                                style={{ fontSize: '0.6875rem', padding: '1px 6px' }}
                                title={`Keep version from ${pr?.targetBranch?.name || 'target'}`}
                              >
                                Accept {pr?.targetBranch?.name || 'target'}
                              </button>
                            )}
                            {c.sourceBranch !== undefined || c.sourceContent !== undefined ? (
                              <button
                                type="button"
                                onClick={() => setResolutionDrafts((prev) => ({ ...prev, [c.filePath]: c.sourceContent || '' }))}
                                className="btn-ghost"
                                style={{ fontSize: '0.6875rem', padding: '1px 6px' }}
                                title={`Keep version from ${pr?.sourceBranch?.name || 'source'}`}
                              >
                                Accept {pr?.sourceBranch?.name || 'source'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setResolutionDrafts((prev) => ({ ...prev, [c.filePath]: c.conflictContent || '' }))}
                              className="btn-ghost"
                              style={{ fontSize: '0.6875rem', padding: '1px 6px', color: 'var(--color-ink-4)' }}
                              title="Reset to raw conflict markers"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={8}
                          value={currentVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setResolutionDrafts((prev) => ({ ...prev, [c.filePath]: val }));
                          }}
                          className="input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', border: 'none', borderRadius: 0, resize: 'vertical' }}
                          placeholder="Remove conflict markers (<<<<<<<, =======, >>>>>>>) and keep final desired code..."
                        />
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowConflictEditor(false)}
                      className="btn-ghost"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleResolveAndPush}
                      disabled={resolvingConflicts}
                      className="btn-primary"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {resolvingConflicts && <Loader2 size={12} className="animate-spin" />}
                      {resolvingConflicts ? 'Pushing resolution…' : 'Commit & push resolution'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main content grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Description */}
              {pr?.description && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '1rem',
                    fontSize: '0.875rem',
                    color: 'var(--color-ink-2)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {pr.description}
                </div>
              )}

              {/* Comments */}
              {comments.map(c => (
                <div
                  key={c._id}
                  style={{
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.875rem', backgroundColor: 'var(--color-base)', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                      {c.author?.username}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
                      {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--color-ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {c.body}
                  </div>
                </div>
              ))}

              {/* Comment form */}
              {user && pr?.status === "open" && (
                <form
                  onSubmit={handleComment}
                  style={{
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.625rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                    <MessageSquare size={13} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} /> Add comment
                  </div>
                  <textarea
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    rows={3}
                    placeholder="Write a comment…"
                    className="input"
                    style={{ marginBottom: '0.75rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={submittingComment || !commentBody.trim()}
                      className="btn-primary"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {submittingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Comment
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Sidebar actions & details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {pr?.status === "open" && user && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                    Actions
                  </p>
                  <button
                    onClick={handleMerge}
                    disabled={merging || conflictData?.hasConflicts}
                    className="btn-primary"
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                  >
                    {merging ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />}
                    {merging ? "Merging…" : conflictData?.hasConflicts ? "Conflicts block merge" : "Merge pull request"}
                  </button>
                  <button
                    onClick={handleClose}
                    disabled={closing}
                    className="btn-ghost"
                    style={{ width: '100%', fontSize: '0.8125rem', color: 'var(--color-danger)' }}
                  >
                    {closing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    Close PR
                  </button>
                </div>
              )}

              <div
                style={{
                  backgroundColor: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                    Author
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                    {pr?.author?.username}
                  </p>
                </div>

                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                    Branches
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-accent-dim)' }}>
                    {pr?.sourceBranch?.name} → {pr?.targetBranch?.name}
                  </p>
                </div>

                {pr?.mergedBy && (
                  <div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                      Merged by
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                      {pr.mergedBy.username}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRDetail;
