import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Circle, Loader2, ArrowLeft, MessageSquare, Send } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const IssueDetail = () => {
  const { owner, name, issueNumber } = useParams();
  const { user } = useAuthStore();
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchIssue = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/repos/${owner}/${name}/issues/${issueNumber}`);
      const data = res.data.data;
      setIssue(data.issue);
      setComments(data.comments || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load issue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssue(); }, [owner, name, issueNumber]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.post(`/repos/${owner}/${name}/issues/${issueNumber}/comments`, { body: commentBody });
      setComments(prev => [...prev, res.data.data.comment]);
      setCommentBody("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const action = issue.status === "open" ? "close" : "reopen";
      await api.put(`/repos/${owner}/${name}/issues/${issueNumber}/${action}`);
      await fetchIssue();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update issue");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="issues" />

      {/* Back button */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to={`/${owner}/${name}/issues`}
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
          <ArrowLeft size={13} strokeWidth={1.75} /> Back to issues
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Loading issue…
        </div>
      ) : error && !issue ? (
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
          {/* Issue Header Title & Status */}
          <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
                {issue?.title}
              </h1>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', color: 'var(--color-ink-4)', fontWeight: 400 }}>
                #{issue?.number}
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
                  backgroundColor: issue?.status === 'closed' ? 'var(--color-surface-2)' : 'var(--color-success-bg)',
                  color: issue?.status === 'closed' ? 'var(--color-ink-3)' : 'var(--color-success)',
                  border: `1px solid ${issue?.status === 'closed' ? 'var(--color-border)' : 'color-mix(in oklch, var(--color-success) 30%, transparent)'}`,
                }}
              >
                {issue?.status === 'closed' ? <CheckCircle2 size={11} strokeWidth={2} /> : <Circle size={10} strokeWidth={2.5} />}
                {issue?.status}
              </span>

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                {issue?.author?.username} opened this issue on {new Date(issue?.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {comments.length} comments
              </span>
            </div>
          </div>

          {/* Issue Body and Comments */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Original Issue Description */}
              {issue?.body && (
                <div
                  style={{
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', backgroundColor: 'var(--color-base)', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                      {issue.author?.username}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>commented</span>
                  </div>
                  <div style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--color-ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {issue.body}
                  </div>
                </div>
              )}

              {/* Comments list */}
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

              {/* Add Comment Box */}
              {user && (
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
                    placeholder="Leave a comment…"
                    className="input"
                    style={{ marginBottom: '0.75rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      onClick={handleToggle}
                      disabled={toggling}
                      className="btn-ghost"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {toggling && <Loader2 size={12} className="animate-spin" />}
                      {issue?.status === "open" ? "Close issue" : "Reopen issue"}
                    </button>
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

            {/* Sidebar meta */}
            <div
              style={{
                backgroundColor: 'var(--color-surface-1)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}
            >
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                  Author
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                  {issue?.author?.username}
                </p>
              </div>

              {issue?.assignees?.length > 0 && (
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                    Assignees
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                    {issue.assignees.map(a => a.username).join(', ')}
                  </p>
                </div>
              )}

              {issue?.closedBy && (
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                    Closed by
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                    {issue.closedBy.username}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueDetail;
