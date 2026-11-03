/**
 * merkle.js — Ported from Python merkle_tree.py
 * Builds a SHA-256 Merkle Tree from file path+content pairs.
 * Used by commitService to compute integrity-verifiable merkleRoot.
 */

const crypto = require('crypto');

/**
 * Compute SHA-256 hash of a string.
 */
const computeHash = (data) => {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
};

/**
 * Build a Merkle tree from an array of { path, content } objects.
 * Returns the root hash string, or '' for empty input.
 */
const buildMerkleTree = (files) => {
  if (!files || files.length === 0) return '';

  // Sort files by path for deterministic ordering (critical for hash reproducibility)
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // Create leaf hashes: SHA-256(path:content)
  let nodes = sorted.map((f) => computeHash(`${f.path}:${f.content}`));

  // Build tree bottom-up — duplicate last node if odd count
  while (nodes.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left; // duplicate if odd
      nextLevel.push(computeHash(left + right));
    }
    nodes = nextLevel;
  }

  return nodes[0];
};

/**
 * Compute a commit SHA-256 hash from its constituent parts.
 * Deterministic: same inputs always produce the exact same hash.
 * Sorted keys in JSON ensure deterministic string serialization.
 */
const computeCommitHash = ({ message, parentHashes = [], merkleRoot, timestamp, authorId }) => {
  const normTimestamp = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
  const normParents = [...(parentHashes || [])].map(String).sort();
  
  // Sorted object keys for deterministic canonical serialization
  const canonicalObj = {
    author: String(authorId),
    merkle_root: String(merkleRoot || ''),
    message: String(message || ''),
    parents: normParents,
    timestamp: normTimestamp,
  };
  
  const data = JSON.stringify(canonicalObj);
  return computeHash(data);
};

/**
 * Verify a Merkle root against a set of files.
 */
const verifyMerkleTree = (files, expectedRoot) => {
  const computedRoot = buildMerkleTree(files);
  return {
    isValid: computedRoot === expectedRoot,
    computedRoot,
    expectedRoot,
  };
};

/**
 * Compute a file content hash (used for FileVersion.contentHash).
 */
const computeContentHash = (content) => computeHash(content == null ? '' : content);

module.exports = {
  buildMerkleTree,
  verifyMerkleTree,
  computeCommitHash,
  computeContentHash,
  computeHash,
};
