import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import useRepoStore from '../store/repoStore';
import { GitCommit, Loader2, GitMerge, ExternalLink } from 'lucide-react';
import RepoHeader from '../components/RepoHeader';

/* ─── Layout constants ─────────────────────────────────────────── */
const ROW_H    = 64;   // px per row
const LANE_W   = 20;   // px per branch lane
const DOT_R    = 5;    // commit dot radius
const PAD_LEFT = 16;   // left padding inside SVG
const PAD_TOP  = 0;

/* ─── Deterministic colour palette (no gradient, no neon) ──────── */
const LANE_COLORS = [
  '#0fa3a3', // teal – primary
  '#6b7ae8', // muted violet
  '#c47a3e', // muted amber
  '#5a9e6f', // muted green
  '#9a5ec8', // muted purple
  '#c05c78', // muted rose
  '#4a8fa8', // steel blue
  '#8a8a50', // olive
];
const laneColor = (i) => LANE_COLORS[i % LANE_COLORS.length];

/* ─── Build layout from flat commits ───────────────────────────── */
function buildLayout(commits) {
  if (!commits.length) return { rows: [], svgWidth: 0 };

  // Map sha → commit for quick lookup
  const byId = new Map(commits.map((c) => [c.sha, c]));

  // Assign each commit to a lane by branch id (stable insertion order)
  const branchLane = new Map();
  let nextLane = 0;
  commits.forEach((c) => {
    const key = c.branch?._id || c.branch?.name || c.branch || 'default';
    if (!branchLane.has(key)) branchLane.set(key, nextLane++);
  });

  const laneCount = Math.max(nextLane, 1);
  const svgWidth = PAD_LEFT + laneCount * LANE_W + 8;

  // Map sha → row index (commits already sorted old→new from API; reverse for display new→old)
  const display = [...commits].reverse();
  const shaRow = new Map(display.map((c, i) => [c.sha, i]));

  const rows = display.map((c, i) => {
    const key = c.branch?._id || c.branch?.name || c.branch || 'default';
    const lane = branchLane.get(key) ?? 0;
    const cx = PAD_LEFT + lane * LANE_W;
    const cy = PAD_TOP + i * ROW_H + ROW_H / 2;
    return { commit: c, lane, cx, cy, row: i };
  });

  // Build edges: for each commit, draw line to each parent
  const edges = [];
  rows.forEach(({ commit, cx, cy }) => {
    (commit.parentShas || []).forEach((pSha) => {
      const pRow = rows[shaRow.get(pSha)];
      if (!pRow) return;
      edges.push({
        x1: cx,  y1: cy,
        x2: pRow.cx, y2: pRow.cy,
        color: laneColor(pRow.lane),
        isMerge: (commit.parentShas || []).length > 1,
      });
    });
  });

  return { rows, edges, svgWidth, laneCount };
}

/* ─── Tooltip / hover card ──────────────────────────────────────── */
const HoverCard = ({ commit, x, y, visible }) => {
  if (!visible || !commit) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: x + 16,
        top: y,
        zIndex: 200,
        pointerEvents: 'none',
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        padding: '0.5rem 0.75rem',
        maxWidth: '280px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-accent)', marginBottom: '2px' }}>
        {commit.sha?.slice(0, 8)}
      </div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.4, marginBottom: '4px', wordBreak: 'break-word' }}>
        {commit.message}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-3)' }}>
        {commit.author?.username} · {new Date(commit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      {commit.isMergeCommit && (
        <div style={{ marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>
          <GitMerge size={10} /> merge commit
        </div>
      )}
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────────── */
const CommitExplorer = () => {
  const { owner, name } = useParams();
  const { currentRepo, fetchRepoDetails } = useRepoStore();
  const [dag, setDag] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(null); // { commit, mouseX, mouseY }
  const [selected, setSelected] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!currentRepo) fetchRepoDetails(owner, name);
  }, [owner, name, currentRepo, fetchRepoDetails]);

  useEffect(() => {
    const fetchDAG = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/repos/${owner}/${name}/commits/dag`);
        setDag(data.data?.dag || data.dag || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch commit graph');
      } finally {
        setLoading(false);
      }
    };
    fetchDAG();
  }, [owner, name]);

  const { rows, edges, svgWidth, laneCount } = useMemo(() => buildLayout(dag), [dag]);
  const svgHeight = rows.length * ROW_H + 8;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="network" />

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.625rem 0.875rem',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
            borderRadius: '4px',
            color: 'var(--color-danger)',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '0.625rem', color: 'var(--color-ink-4)', fontSize: '0.875rem' }}>
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> Building DAG…
        </div>
      ) : dag.length === 0 ? (
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
          <GitCommit size={28} strokeWidth={1.25} style={{ margin: '0 auto 0.75rem', color: 'var(--color-ink-4)' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--color-ink)' }}>
            No commits yet
          </p>
        </div>
      ) : (
        <>
          {/* ── Legend ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              padding: '0.5rem 0.75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--color-surface-1)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              branches
            </span>
            {(() => {
              const seen = new Map();
              rows.forEach(({ commit, lane }) => {
                const label = commit.branch?.name || 'unknown';
                if (!seen.has(label)) seen.set(label, lane);
              });
              return [...seen.entries()].map(([label, lane]) => (
                <span
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--color-ink-2)',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: laneColor(lane),
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  {label}
                </span>
              ));
            })()}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-4)' }}>
              {dag.length} commit{dag.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* ── Graph + List ── */}
          <div
            ref={containerRef}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-1)',
              overflowX: 'auto',
              overflowY: 'visible',
              position: 'relative',
            }}
          >
            {/* SVG graph column, scrolls horizontally with the table */}
            <div style={{ display: 'flex', minWidth: 0 }}>

              {/* Left: SVG graph */}
              <div
                style={{
                  flexShrink: 0,
                  width: svgWidth + 8,
                  borderRight: '1px solid var(--color-border)',
                  position: 'relative',
                }}
              >
                <svg
                  width={svgWidth + 8}
                  height={svgHeight}
                  style={{ display: 'block' }}
                >
                  {/* Edges */}
                  {edges.map((e, i) => (
                    <path
                      key={i}
                      d={
                        e.x1 === e.x2
                          ? `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`
                          : `M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`
                      }
                      stroke={e.color}
                      strokeWidth={1.5}
                      fill="none"
                      strokeOpacity={0.65}
                    />
                  ))}

                  {/* Commit dots */}
                  {rows.map(({ commit, cx, cy, lane }) => (
                    <g key={commit.sha}>
                      {/* Hit area */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={DOT_R + 6}
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => setHovered({ commit, mouseX: e.clientX, mouseY: e.clientY })}
                        onMouseMove={(e) => setHovered((prev) => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : prev)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => setSelected((s) => s?.sha === commit.sha ? null : commit)}
                      />
                      {/* Outer ring for merge commits */}
                      {commit.isMergeCommit && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={DOT_R + 3}
                          fill="none"
                          stroke={laneColor(lane)}
                          strokeWidth={1}
                          strokeOpacity={0.4}
                        />
                      )}
                      {/* Main dot */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={DOT_R}
                        fill={selected?.sha === commit.sha ? 'var(--color-ink)' : laneColor(lane)}
                        stroke="var(--color-base)"
                        strokeWidth={1.5}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => setHovered({ commit, mouseX: e.clientX, mouseY: e.clientY })}
                        onMouseMove={(e) => setHovered((prev) => prev ? { ...prev, mouseX: e.clientX, mouseY: e.clientY } : prev)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => setSelected((s) => s?.sha === commit.sha ? null : commit)}
                      />
                    </g>
                  ))}
                </svg>
              </div>

              {/* Right: commit list rows, aligned to graph rows */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {rows.map(({ commit, lane }, i) => (
                  <div
                    key={commit.sha}
                    style={{
                      height: ROW_H,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0 1rem',
                      borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--color-border)',
                      backgroundColor: selected?.sha === commit.sha ? 'var(--color-surface-2)' : 'transparent',
                      transition: 'background-color 100ms',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelected((s) => s?.sha === commit.sha ? null : commit)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = selected?.sha === commit.sha
                        ? 'var(--color-surface-2)'
                        : 'color-mix(in oklch, var(--color-surface-2) 60%, transparent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = selected?.sha === commit.sha
                        ? 'var(--color-surface-2)'
                        : 'transparent';
                    }}
                  >
                    {/* Branch lane color stripe */}
                    <span
                      style={{
                        flexShrink: 0,
                        width: 3,
                        height: 32,
                        borderRadius: 2,
                        backgroundColor: laneColor(lane),
                        opacity: 0.6,
                      }}
                    />

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--color-ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '60%',
                          }}
                          title={commit.message}
                        >
                          {commit.message}
                        </span>

                        {commit.isMergeCommit && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.625rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              border: '1px solid color-mix(in oklch, #a78bfa 30%, transparent)',
                              backgroundColor: 'color-mix(in oklch, #a78bfa 10%, transparent)',
                              color: '#a78bfa',
                              flexShrink: 0,
                            }}
                          >
                            <GitMerge size={9} /> merge
                          </span>
                        )}

                        {commit.branch?.name && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.625rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              border: `1px solid ${laneColor(lane)}33`,
                              backgroundColor: `${laneColor(lane)}11`,
                              color: laneColor(lane),
                              flexShrink: 0,
                            }}
                          >
                            {commit.branch.name}
                          </span>
                        )}
                      </div>

                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-3)', marginTop: '2px' }}>
                        {commit.author?.username} ·{' '}
                        {new Date(commit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {(commit.parentShas || []).length > 1 && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--color-ink-4)' }}>
                            {commit.parentShas.length} parents
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SHA + link */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.6875rem',
                          color: 'var(--color-ink-3)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '3px',
                          padding: '2px 6px',
                          backgroundColor: 'var(--color-base)',
                        }}
                      >
                        {commit.sha?.slice(0, 7)}
                      </span>
                      <Link
                        to={`/${owner}/${name}/commit/${commit.sha}`}
                        onClick={(e) => e.stopPropagation()}
                        title="View commit"
                        style={{
                          color: 'var(--color-ink-4)',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color 100ms',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ink-4)')}
                      >
                        <ExternalLink size={12} strokeWidth={1.5} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Selected commit detail panel ── */}
            {selected && (
              <div
                style={{
                  borderTop: '1px solid var(--color-border)',
                  padding: '1rem 1.25rem',
                  backgroundColor: 'var(--color-base)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    commit
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-accent)', wordBreak: 'break-all' }}>
                    {selected.sha}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    message
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-ink)', fontWeight: 600 }}>
                    {selected.message}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    author
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                    {selected.author?.username}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    date
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                    {new Date(selected.createdAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    merkle root
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-3)', wordBreak: 'break-all' }}>
                    {selected.merkleRoot?.slice(0, 32)}…
                  </div>
                </div>
                {(selected.parentShas || []).length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-ink-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      parent{(selected.parentShas || []).length > 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {(selected.parentShas || []).map((p) => (
                        <span key={p} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-accent-dim)' }}>
                          {p.slice(0, 8)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Link
                    to={`/${owner}/${name}/commit/${selected.sha}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--color-accent)',
                      textDecoration: 'none',
                      borderBottom: '1px solid color-mix(in oklch, var(--color-accent) 40%, transparent)',
                      paddingBottom: '1px',
                      transition: 'opacity 100ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    <ExternalLink size={12} strokeWidth={1.75} /> View full commit
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Hover tooltip */}
      <HoverCard
        commit={hovered?.commit}
        x={hovered?.mouseX || 0}
        y={hovered?.mouseY || 0}
        visible={!!hovered && !selected}
      />
    </div>
  );
};

export default CommitExplorer;
