import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { File as FileIcon, ArrowLeft, HardDrive, Hash, Download, Loader2 } from 'lucide-react';
import useRepoStore from '../store/repoStore';
import RepoHeader from '../components/RepoHeader';

const FileViewer = () => {
  const { owner, name, branch, '*': filePath } = useParams();
  const { currentFile, fetchFileContent, isLoading, error } = useRepoStore();

  useEffect(() => {
    fetchFileContent(owner, name, branch, filePath);
  }, [owner, name, branch, filePath, fetchFileContent]);

  if (isLoading && !currentFile) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--color-accent)', margin: '0 auto 1rem' }} />
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
          Loading file content…
        </p>
      </div>
    );
  }

  if (error || !currentFile) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <RepoHeader owner={owner} name={name} activeTab="code" />
        <div
          role="alert"
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in oklch, var(--color-danger) 35%, transparent)',
            borderRadius: '4px',
            color: 'var(--color-danger)',
            fontSize: '0.8125rem',
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>File Error</p>
          <p>{error || 'File not found.'}</p>
          <Link to={`/${owner}/${name}`} style={{ color: 'var(--color-danger)', textDecoration: 'underline', marginTop: '0.5rem', display: 'inline-block' }}>
            ← Return to repository
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="code" />

      {/* Path Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
          <Link
            to={`/${owner}/${name}`}
            className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
          >
            <ArrowLeft size={12} strokeWidth={1.75} /> Files
          </Link>
          <span style={{ color: 'var(--color-ink-4)' }}>/</span>
          <span style={{ color: 'var(--color-ink-3)', padding: '1px 5px', border: '1px solid var(--color-border)', borderRadius: '3px', fontSize: '0.75rem' }}>
            {branch}
          </span>
          <span style={{ color: 'var(--color-ink-4)' }}>/</span>
          <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{filePath}</span>
        </div>
      </div>

      {/* File Card */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface-1)',
        }}
      >
        {/* File Metadata Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.875rem',
            backgroundColor: 'var(--color-base)',
            borderBottom: '1px solid var(--color-border)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--color-ink-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <HardDrive size={12} strokeWidth={1.5} />
              {(currentFile.fileSize / 1024).toFixed(2)} KB
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} title="SHA-256 Content Hash">
              <Hash size={12} strokeWidth={1.5} />
              {currentFile.contentHash.substring(0, 12)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              to={`/${owner}/${name}/analytics?tab=file-history&path=${encodeURIComponent(filePath)}`}
              className="btn-ghost"
              style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', color: 'var(--color-accent)' }}
              title="Inspect complete snapshot history across all branches in MongoDB"
            >
              All Branches History →
            </Link>

            <button
              onClick={() => {
                const blob = new Blob([currentFile.content || ''], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filePath.split('/').pop() || 'file';
                a.click();
              }}
              className="btn-ghost"
              style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem' }}
            >
              <Download size={11} strokeWidth={1.75} /> Raw
            </button>
          </div>
        </div>

        {/* File Content */}
        <div style={{ padding: '1rem', overflowX: 'auto', backgroundColor: 'var(--color-surface-1)' }}>
          <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)', lineHeight: 1.65 }}>
            <code>{currentFile.content || '/* Empty file */'}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
