/**
 * seed.js — Rich seeder for Mimir VCS
 *
 * Creates a realistic dataset:
 *   Users     : alice (owner), bob (developer), charlie (maintainer)
 *   Repos     : mimir-core (public), react-frontend (public)
 *   Branches  : main, feature/auth, feature/dag-viz, hotfix/null-ptr
 *   Commits   : 10 commits forming a real DAG (branches + merge commits)
 *   Files     : README.md, src/index.js, src/merkle.js, src/auth.js, tests/
 *   Merges    : 2 merge operations (merge + squash strategies)
 *   PRs       : 3 pull requests (open / merged / closed)
 *   Issues    : 4 issues (open / closed)
 */

const mongoose = require("mongoose");
const dotenv   = require("dotenv");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");
const path     = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const User             = require("../models/User");
const Repository       = require("../models/Repository");
const RepositoryMember = require("../models/RepositoryMember");
const Branch           = require("../models/Branch");
const Commit           = require("../models/Commit");
const File             = require("../models/File");
const FileVersion      = require("../models/FileVersion");
const Issue            = require("../models/Issue");
const PullRequest      = require("../models/PullRequest");
const MergeOperation   = require("../models/MergeOperation");
const ActivityLog      = require("../models/ActivityLog");
const Tag              = require("../models/Tag");
const Release          = require("../models/Release");
const Notification     = require("../models/Notification");
const Label            = require("../models/Label");
const IssueComment     = require("../models/IssueComment");
const PRComment        = require("../models/PRComment");
const connectDB        = require("../config/db");
const { buildMerkleTree, computeCommitHash, computeContentHash } = require("../utils/merkle");

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const makeTree = (entries) => entries.map(([p, fvId]) => ({ path: p, fileVersion: fvId }));

const CONTENTS = {
  "README.md":
    "# Mimir Core\n\nA distributed version control system built on MongoDB.\n\n## Features\n- SHA-256 Merkle Tree integrity\n- ACID transactions\n- DAG-based commit history\n",
  "README_v2.md":
    "# Mimir Core\n\nA distributed version control system built on MongoDB.\n\n## Features\n- SHA-256 Merkle Tree integrity\n- ACID transactions\n- DAG-based commit history\n\n## Getting Started\n```bash\nnpm install\nnode server.js\n```\n",
  ".gitignore": "node_modules/\n.env\ndist/\n*.log\n",
  ".gitignore_v2": "node_modules/\n.env\ndist/\n*.log\ncoverage/\n",
  "src/index.js":
    "const express = require(\"express\");\nconst connectDB = require(\"./config/db\");\nconst routes = require(\"./routes\");\n\nconnectDB();\nconst app = express();\napp.use(express.json());\napp.use(\"/api\", routes);\napp.listen(5000);\n",
  "src/merkle.js":
    "const crypto = require(\"crypto\");\n\nconst computeContentHash = (content) =>\n  crypto.createHash(\"sha256\").update(content).digest(\"hex\");\n\nconst buildMerkleTree = (files) => {\n  const hashes = files.map(f => computeContentHash(f.content));\n  if (hashes.length === 1) return hashes[0];\n  while (hashes.length > 1) {\n    const next = [];\n    for (let i = 0; i < hashes.length; i += 2) {\n      const combined = hashes[i] + (hashes[i+1] || hashes[i]);\n      next.push(crypto.createHash(\"sha256\").update(combined).digest(\"hex\"));\n    }\n    hashes.splice(0, hashes.length, ...next);\n  }\n  return hashes[0];\n};\n\nmodule.exports = { computeContentHash, buildMerkleTree };\n",
  "src/merkle_v2.js":
    "const crypto = require(\"crypto\");\n\n// Fixed: guard against empty file content\nconst computeContentHash = (content) => {\n  if (!content) content = \"\";\n  return crypto.createHash(\"sha256\").update(content).digest(\"hex\");\n};\n\nconst buildMerkleTree = (files) => {\n  const hashes = files.map(f => computeContentHash(f.content || \"\"));\n  if (hashes.length === 0) return computeContentHash(\"\");\n  if (hashes.length === 1) return hashes[0];\n  while (hashes.length > 1) {\n    const next = [];\n    for (let i = 0; i < hashes.length; i += 2) {\n      const combined = hashes[i] + (hashes[i+1] || hashes[i]);\n      next.push(crypto.createHash(\"sha256\").update(combined).digest(\"hex\"));\n    }\n    hashes.splice(0, hashes.length, ...next);\n  }\n  return hashes[0];\n};\n\nmodule.exports = { computeContentHash, buildMerkleTree };\n",
  "src/auth.js":
    "const jwt = require(\"jsonwebtoken\");\nconst bcrypt = require(\"bcryptjs\");\nconst User = require(\"../models/User\");\n\nexports.login = async (req, res) => {\n  const { email, password } = req.body;\n  const user = await User.findOne({ email }).select(\"+passwordHash\");\n  if (!user || !(await bcrypt.compare(password, user.passwordHash)))\n    return res.status(401).json({ message: \"Invalid credentials\" });\n  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: \"7d\" });\n  res.json({ token });\n};\n\nexports.register = async (req, res) => {\n  const { username, email, password } = req.body;\n  const hash = await bcrypt.hash(password, 10);\n  const user = await User.create({ username, email, passwordHash: hash });\n  res.status(201).json({ user });\n};\n",
  "src/auth_v2.js":
    "const jwt = require(\"jsonwebtoken\");\nconst bcrypt = require(\"bcryptjs\");\nconst User = require(\"../models/User\");\n\nexports.login = async (req, res) => {\n  const { email, password } = req.body;\n  const user = await User.findOne({ email }).select(\"+passwordHash\");\n  if (!user || !(await bcrypt.compare(password, user.passwordHash)))\n    return res.status(401).json({ message: \"Invalid credentials\" });\n  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: \"7d\" });\n  const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET || \"refresh\", { expiresIn: \"30d\" });\n  res.json({ token, refreshToken });\n};\n\nexports.register = async (req, res) => {\n  const { username, email, password } = req.body;\n  const hash = await bcrypt.hash(password, 12);\n  const user = await User.create({ username, email, passwordHash: hash });\n  res.status(201).json({ user });\n};\n\nexports.refresh = async (req, res) => {\n  const { refreshToken } = req.body;\n  const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET || \"refresh\");\n  const newToken = jwt.sign({ id: payload.id }, process.env.JWT_SECRET, { expiresIn: \"7d\" });\n  res.json({ token: newToken });\n};\n",
  "src/dag.js":
    "const Commit = require(\"../models/Commit\");\n\nconst getAncestors = async (commitId, visited = new Set()) => {\n  const queue = [commitId];\n  const ancestors = [];\n  while (queue.length) {\n    const id = queue.shift();\n    if (visited.has(String(id))) continue;\n    visited.add(String(id));\n    const commit = await Commit.findById(id).select(\"parentCommits sha message\");\n    if (!commit) continue;\n    ancestors.push(commit);\n    commit.parentCommits.forEach(p => queue.push(p));\n  }\n  return ancestors;\n};\n\nmodule.exports = { getAncestors };\n",
  "tests/merkle.test.js":
    "const { computeContentHash, buildMerkleTree } = require(\"../src/merkle\");\n\ndescribe(\"Merkle Tree\", () => {\n  test(\"single file hash is stable\", () => {\n    expect(computeContentHash(\"hello\")).toBe(computeContentHash(\"hello\"));\n  });\n  test(\"different content produces different hash\", () => {\n    expect(computeContentHash(\"a\")).not.toBe(computeContentHash(\"b\"));\n  });\n  test(\"merkle root changes when any file changes\", () => {\n    const r1 = buildMerkleTree([{ content: \"a\" }, { content: \"b\" }]);\n    const r2 = buildMerkleTree([{ content: \"a\" }, { content: \"c\" }]);\n    expect(r1).not.toBe(r2);\n  });\n});\n",
};

const seedDB = async () => {
  try {
    await connectDB();
    await mongoose.connection.db.dropDatabase();
    console.log("Database dropped.");

    // 1. Users
    const passwordHash = await bcrypt.hash("password123", 10);
    const [alice, bob, charlie] = await User.insertMany([
      { username: "alice",   email: "alice@example.com",   passwordHash, bio: "Fullstack Dev & Mimir creator" },
      { username: "bob",     email: "bob@example.com",     passwordHash, bio: "Backend Engineer" },
      { username: "charlie", email: "charlie@example.com", passwordHash, bio: "DevOps & Testing" },
    ]);
    console.log("Users created.");

    // 2. Repos
    const [mimirCore, reactFrontend] = await Repository.insertMany([
      { name: "mimir-core",     owner: alice._id, description: "Core VCS engine with MongoDB-native DAG and Merkle Trees", visibility: "public" },
      { name: "react-frontend", owner: bob._id,   description: "React UI for Mimir",  visibility: "public" },
    ]);
    console.log("Repos created.");

    // 3. Members
    await RepositoryMember.insertMany([
      { repository: mimirCore._id,     user: alice._id,   role: "owner" },
      { repository: mimirCore._id,     user: bob._id,     role: "developer" },
      { repository: mimirCore._id,     user: charlie._id, role: "maintainer" },
      { repository: reactFrontend._id, user: bob._id,     role: "owner" },
      { repository: reactFrontend._id, user: charlie._id, role: "maintainer" },
    ]);

    // 4. Branches
    const [mimirMain, featureAuth, featureDag, hotfix] = await Branch.insertMany([
      { repository: mimirCore._id, name: "main",            creator: alice._id,   isProtected: true },
      { repository: mimirCore._id, name: "feature/auth",    creator: bob._id },
      { repository: mimirCore._id, name: "feature/dag-viz", creator: charlie._id },
      { repository: mimirCore._id, name: "hotfix/null-ptr", creator: alice._id },
      { repository: reactFrontend._id, name: "main",        creator: bob._id, isProtected: true },
    ]);
    console.log("Branches created.");

    // Helper: create file + version
    const createFV = async (repoId, commitId, filePath, content, versionNumber) => {
      let fileDoc = await File.findOne({ repository: repoId, path: filePath });
      if (!fileDoc) fileDoc = await File.create({ repository: repoId, path: filePath, isDeleted: false });
      const fv = await FileVersion.create({
        repository: repoId, file: fileDoc._id, filePath, content,
        contentHash: sha(content), commit: commitId, versionNumber,
        fileSize: Buffer.byteLength(content, "utf8"),
      });
      await File.updateOne({ _id: fileDoc._id }, { latestVersion: fv._id, isDeleted: false });
      return { fileDoc, fv };
    };

    // 5. Commits — DAG structure:
    //   C1(main) -> C2(main) -> C3(main) -+-> C7(main, MERGE) -> C9(main) -> C10(main, SQUASH MERGE)
    //                \                    |  /                                  /
    //                 C4(feature/auth) -> C5 -> C6(feature/auth)               /
    //                  C3 also -> C8(feature/dag-viz) [open PR]               /
    //                             C7 -> Chf(hotfix) -------------------------+

    // Helper: create a cryptographically verified commit + tree file versions
    const seedCommit = async ({ repoId, branchId, author, message, parentCommits = [], fileSpecs, isMerge = false, date }) => {
      const fileObjects = fileSpecs.map(f => ({ path: f.path, content: f.content }));
      const merkleRoot = buildMerkleTree(fileObjects);
      const parentHashes = parentCommits.map(p => p.sha).filter(Boolean);
      const commitSha = computeCommitHash({
        message,
        parentHashes,
        merkleRoot,
        timestamp: date,
        authorId: author._id,
      });

      const commitDoc = await Commit.create({
        repository: repoId,
        branch: branchId,
        author: author._id,
        message,
        sha: commitSha,
        merkleRoot,
        parentCommits: parentCommits.map(p => p._id),
        isMergeCommit: isMerge,
        timestamp: date,
        createdAt: date,
      });

      const tree = [];
      for (const spec of fileSpecs) {
        let fileDoc = await File.findOne({ repository: repoId, path: spec.path });
        if (!fileDoc) {
          fileDoc = await File.create({ repository: repoId, path: spec.path, isDeleted: false });
        }
        const fv = await FileVersion.create({
          repository: repoId,
          file: fileDoc._id,
          filePath: spec.path,
          content: spec.content,
          contentHash: computeContentHash(spec.content),
          commit: commitDoc._id,
          versionNumber: spec.versionNumber || 1,
          fileSize: Buffer.byteLength(spec.content, "utf8"),
        });
        await File.updateOne({ _id: fileDoc._id }, { latestVersion: fv._id, isDeleted: false });
        tree.push({ path: spec.path, fileVersion: fv._id });
      }

      await Commit.updateOne({ _id: commitDoc._id }, { tree });
      commitDoc.tree = tree;
      return commitDoc;
    };

    // 5. Commits — DAG structure:
    //   C1(main) -> C2(main) -> C3(main) -+-> C7(main, MERGE) -> C9(main) -> C10(main, SQUASH MERGE)
    //                \                    |  /                                  /
    //                 C4(feature/auth) -> C5 -> C6(feature/auth)               /
    //                  C3 also -> C8(feature/dag-viz) [open PR]               /
    //                             C7 -> Chf(hotfix) -------------------------+

    // C1: Initial commit on main
    const c1 = await seedCommit({
      repoId: mimirCore._id,
      branchId: mimirMain._id,
      author: alice,
      message: "Initial commit — add README and .gitignore",
      parentCommits: [],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README.md"], versionNumber: 1 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
      ],
      date: new Date("2026-09-01T09:00:00Z"),
    });

    // C2: Add src files on main
    const c2 = await seedCommit({
      repoId: mimirCore._id,
      branchId: mimirMain._id,
      author: alice,
      message: "Add Express server and Merkle tree implementation",
      parentCommits: [c1],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README.md"], versionNumber: 1 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-05T10:30:00Z"),
    });

    // C3: Update README on main
    const c3 = await seedCommit({
      repoId: mimirCore._id,
      branchId: mimirMain._id,
      author: alice,
      message: "docs: update README with Getting Started guide",
      parentCommits: [c2],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README_v2.md"], versionNumber: 2 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-08T14:00:00Z"),
    });

    // C4: Branch off C2 — feature/auth (bob)
    const c4 = await seedCommit({
      repoId: mimirCore._id,
      branchId: featureAuth._id,
      author: bob,
      message: "feat: scaffold auth controller (login + register)",
      parentCommits: [c2],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README.md"], versionNumber: 1 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
        { path: "src/auth.js", content: CONTENTS["src/auth.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-09T09:15:00Z"),
    });

    // C5: Add refresh token — feature/auth (bob)
    const c5 = await seedCommit({
      repoId: mimirCore._id,
      branchId: featureAuth._id,
      author: bob,
      message: "feat(auth): add refresh token endpoint",
      parentCommits: [c4],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README.md"], versionNumber: 1 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
        { path: "src/auth.js", content: CONTENTS["src/auth_v2.js"], versionNumber: 2 },
      ],
      date: new Date("2026-09-11T11:00:00Z"),
    });

    // C6: Add tests — feature/auth (charlie)
    const c6 = await seedCommit({
      repoId: mimirCore._id,
      branchId: featureAuth._id,
      author: charlie,
      message: "test: add Merkle tree unit tests",
      parentCommits: [c5],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README.md"], versionNumber: 1 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
        { path: "src/auth.js", content: CONTENTS["src/auth_v2.js"], versionNumber: 2 },
        { path: "tests/merkle.test.js", content: CONTENTS["tests/merkle.test.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-13T16:30:00Z"),
    });

    // C7: MERGE COMMIT — feature/auth into main (alice) — two parents!
    const c7 = await seedCommit({
      repoId: mimirCore._id,
      branchId: mimirMain._id,
      author: alice,
      message: "Merge branch 'feature/auth' into main",
      parentCommits: [c3, c6],
      isMerge: true,
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README_v2.md"], versionNumber: 2 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
        { path: "src/auth.js", content: CONTENTS["src/auth_v2.js"], versionNumber: 2 },
        { path: "tests/merkle.test.js", content: CONTENTS["tests/merkle.test.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-15T10:00:00Z"),
    });

    // C8: feature/dag-viz branch off C3 (charlie) — open PR, not merged
    const c8 = await seedCommit({
      repoId: mimirCore._id,
      branchId: featureDag._id,
      author: charlie,
      message: "feat: add DAG traversal utility (BFS-based getAncestors)",
      parentCommits: [c3],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README_v2.md"], versionNumber: 2 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
        { path: "src/dag.js", content: CONTENTS["src/dag.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-16T12:00:00Z"),
    });

    // C9: Chore commit on main after merge (alice)
    const c9 = await seedCommit({
      repoId: mimirCore._id,
      branchId: mimirMain._id,
      author: alice,
      message: "chore: update .gitignore to exclude test coverage output",
      parentCommits: [c7],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README_v2.md"], versionNumber: 2 },
        { path: ".gitignore", content: CONTENTS[".gitignore_v2"], versionNumber: 2 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle.js"], versionNumber: 1 },
        { path: "src/auth.js", content: CONTENTS["src/auth_v2.js"], versionNumber: 2 },
        { path: "tests/merkle.test.js", content: CONTENTS["tests/merkle.test.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-20T09:00:00Z"),
    });

    // Chf: hotfix branch off C7 (alice)
    const chf = await seedCommit({
      repoId: mimirCore._id,
      branchId: hotfix._id,
      author: alice,
      message: "fix: null pointer in merkle.js for empty file content",
      parentCommits: [c7],
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README_v2.md"], versionNumber: 2 },
        { path: ".gitignore", content: CONTENTS[".gitignore"], versionNumber: 1 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle_v2.js"], versionNumber: 2 },
        { path: "src/auth.js", content: CONTENTS["src/auth_v2.js"], versionNumber: 2 },
        { path: "tests/merkle.test.js", content: CONTENTS["tests/merkle.test.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-22T08:00:00Z"),
    });

    // C10: SQUASH MERGE commit — hotfix into main (alice) — two parents!
    const c10 = await seedCommit({
      repoId: mimirCore._id,
      branchId: mimirMain._id,
      author: alice,
      message: "fix: null pointer in merkle (squash merge hotfix/null-ptr)",
      parentCommits: [c9, chf],
      isMerge: true,
      fileSpecs: [
        { path: "README.md", content: CONTENTS["README_v2.md"], versionNumber: 2 },
        { path: ".gitignore", content: CONTENTS[".gitignore_v2"], versionNumber: 2 },
        { path: "src/index.js", content: CONTENTS["src/index.js"], versionNumber: 1 },
        { path: "src/merkle.js", content: CONTENTS["src/merkle_v2.js"], versionNumber: 2 },
        { path: "src/auth.js", content: CONTENTS["src/auth_v2.js"], versionNumber: 2 },
        { path: "tests/merkle.test.js", content: CONTENTS["tests/merkle.test.js"], versionNumber: 1 },
      ],
      date: new Date("2026-09-25T11:00:00Z"),
    });

    // Update branch HEADs
    await Branch.updateOne({ _id: mimirMain._id },  { headCommit: c10._id });
    await Branch.updateOne({ _id: featureAuth._id }, { headCommit: c6._id });
    await Branch.updateOne({ _id: featureDag._id },  { headCommit: c8._id });
    await Branch.updateOne({ _id: hotfix._id },      { headCommit: chf._id });

    console.log("Commits + file versions created (10 commits, 2 merge commits in DAG).");

    // 6. Merge Operations
    await MergeOperation.insertMany([
      {
        repository: mimirCore._id, sourceBranch: featureAuth._id, targetBranch: mimirMain._id,
        mergeCommit: c7._id, mergedBy: alice._id, strategy: "merge",
        createdAt: new Date("2026-09-15T10:00:00Z"),
      },
      {
        repository: mimirCore._id, sourceBranch: hotfix._id, targetBranch: mimirMain._id,
        mergeCommit: c10._id, mergedBy: alice._id, strategy: "squash",
        createdAt: new Date("2026-09-25T11:00:00Z"),
      },
    ]);
    console.log("Merge operations created (1 merge + 1 squash).");

    // 7. Pull Requests
    const [pr1, pr2, pr3] = await PullRequest.insertMany([
      {
        repository: mimirCore._id, number: 1,
        title: "feat: JWT authentication with refresh tokens",
        description: "Implements login, register, and refresh token endpoints. Includes Merkle tree unit tests.",
        sourceBranch: featureAuth._id, targetBranch: mimirMain._id,
        author: bob._id, status: "merged",
        createdAt: new Date("2026-09-12T09:00:00Z"),
      },
      {
        repository: mimirCore._id, number: 2,
        title: "feat: DAG traversal BFS utility (src/dag.js)",
        description: "Adds BFS-based getAncestors() helper for traversing commit graph. Useful for merge-base detection.",
        sourceBranch: featureDag._id, targetBranch: mimirMain._id,
        author: charlie._id, status: "open",
        createdAt: new Date("2026-09-17T10:00:00Z"),
      },
      {
        repository: mimirCore._id, number: 3,
        title: "chore: remove deprecated MD5 hash fallback",
        description: "Cleans up old MD5 fallback from the prototype phase. Not needed since all hashing is SHA-256.",
        sourceBranch: hotfix._id, targetBranch: mimirMain._id,
        author: alice._id, status: "closed",
        createdAt: new Date("2026-09-18T08:00:00Z"),
      },
    ]);
    console.log("Pull Requests created (merged / open / closed).");

    // 7b. PR Comments
    await PRComment.insertMany([
      {
        pullRequest: pr1._id,
        author: alice._id,
        body: "LGTM! The Merkle tree tests cover the edge cases thoroughly. Merging now.",
        createdAt: new Date("2026-09-14T15:00:00Z"),
      },
      {
        pullRequest: pr2._id,
        author: alice._id,
        body: "Great helper function. Can we also add cycle detection tests just in case?",
        createdAt: new Date("2026-09-19T11:20:00Z"),
      },
      {
        pullRequest: pr2._id,
        author: charlie._id,
        body: "Working on cycle detection tests now, will push an update soon.",
        createdAt: new Date("2026-09-19T14:10:00Z"),
      },
    ]);
    console.log("PR Comments created.");

    // 8. Labels
    const [labelBug, labelFeat, labelDoc, labelSec] = await Label.insertMany([
      { repository: mimirCore._id, name: "bug", color: "#d73a4a", description: "Something isn't working" },
      { repository: mimirCore._id, name: "enhancement", color: "#a2eeef", description: "New feature or request" },
      { repository: mimirCore._id, name: "documentation", color: "#0075ca", description: "Improvements or additions to documentation" },
      { repository: mimirCore._id, name: "security", color: "#e99695", description: "Security vulnerability or audit item" },
    ]);
    console.log("Labels created.");

    // 8b. Issues
    const [issue1, issue2, issue3, issue4] = await Issue.insertMany([
      {
        repository: mimirCore._id, number: 1,
        title: "Merkle tree throws on empty file content",
        body: "When a file with zero bytes is committed, buildMerkleTree throws a TypeError. Needs a null guard in computeContentHash.",
        author: bob._id, status: "closed",
        labels: [labelBug._id],
        assignees: [alice._id],
        createdAt: new Date("2026-09-18T07:00:00Z"),
      },
      {
        repository: mimirCore._id, number: 2,
        title: "DAG visualizer does not render merge commits correctly",
        body: "Merge commits have two parent SHAs but the canvas only draws one connecting line. The bezier curve logic needs updating to handle multiple parents.",
        author: charlie._id, status: "open",
        labels: [labelBug._id, labelFeat._id],
        assignees: [charlie._id],
        createdAt: new Date("2026-09-20T12:00:00Z"),
      },
      {
        repository: mimirCore._id, number: 3,
        title: "Protected branch should block rename and delete",
        body: "Currently isProtected only guards the commit API. The branch rename and delete endpoints have no protection check.",
        author: alice._id, status: "open",
        labels: [labelSec._id],
        assignees: [bob._id],
        createdAt: new Date("2026-09-23T09:30:00Z"),
      },
      {
        repository: mimirCore._id, number: 4,
        title: "Add cursor-based pagination to commit history endpoint",
        body: "The /commits?branch=main endpoint returns all commits. On large repos this becomes slow. Implement cursor-based pagination.",
        author: bob._id, status: "closed",
        labels: [labelFeat._id],
        createdAt: new Date("2026-09-10T11:00:00Z"),
      },
    ]);
    console.log("Issues created (2 open / 2 closed).");

    // 8c. Issue Comments
    await IssueComment.insertMany([
      {
        issue: issue1._id,
        author: alice._id,
        body: "Patched in commit hotfix/null-ptr. computeContentHash now provides empty string fallback.",
        createdAt: new Date("2026-09-18T16:00:00Z"),
      },
      {
        issue: issue2._id,
        author: bob._id,
        body: "I noticed this on Chrome 128 as well. Bezier curve control points need an offset for secondary parents.",
        createdAt: new Date("2026-09-21T09:15:00Z"),
      },
    ]);
    console.log("Issue Comments created.");

    // 8d. Tags & Releases
    const tagV1 = await Tag.create({
      repository: mimirCore._id,
      name: "v1.0.0",
      commit: c3._id,
      creator: alice._id,
      message: "First official stable release of Mimir VCS engine",
    });

    const tagV11 = await Tag.create({
      repository: mimirCore._id,
      name: "v1.1.0",
      commit: c7._id,
      creator: alice._id,
      message: "Version 1.1.0 with JWT auth and verified Merkle integrity",
    });

    await Release.insertMany([
      {
        repository: mimirCore._id,
        tag: tagV1._id,
        commit: c3._id,
        author: alice._id,
        name: "v1.0.0 — Genesis Release",
        body: "## Mimir v1.0.0\n\nWelcome to the initial stable release of **Mimir** — the MongoDB-centric Git VCS!\n\n### Highlights\n- SHA-256 Merkle Tree snapshots\n- Branch management with default protection\n- Immutable file version blobs\n- Multi-parent commit DAG",
        isDraft: false,
        isPrerelease: false,
      },
      {
        repository: mimirCore._id,
        tag: tagV11._id,
        commit: c7._id,
        author: alice._id,
        name: "v1.1.0 — Security & Refresh Tokens",
        body: "## Mimir v1.1.0\n\n### New Features\n- Full JWT authentication with 30-day refresh tokens\n- Unit tests for cryptographic hashing\n- Merged `feature/auth` into main",
        isDraft: false,
        isPrerelease: false,
      },
    ]);
    console.log("Tags and Releases created.");

    // 8e. Notifications
    await Notification.insertMany([
      {
        recipient: alice._id,
        actor: bob._id,
        type: "pr_opened",
        message: "bob opened pull request #1: feat: JWT authentication",
        relatedEntity: pr1._id,
        entityModel: "PullRequest",
        read: true,
        createdAt: new Date("2026-09-12T09:05:00Z"),
      },
      {
        recipient: alice._id,
        actor: charlie._id,
        type: "pr_opened",
        message: "charlie opened pull request #2: feat: DAG traversal BFS utility",
        relatedEntity: pr2._id,
        entityModel: "PullRequest",
        read: false,
        createdAt: new Date("2026-09-17T10:05:00Z"),
      },
      {
        recipient: bob._id,
        actor: alice._id,
        type: "issue_assigned",
        message: "alice assigned you to issue #3: Protected branch should block rename and delete",
        relatedEntity: issue3._id,
        entityModel: "Issue",
        read: false,
        createdAt: new Date("2026-09-23T09:35:00Z"),
      },
      {
        recipient: charlie._id,
        actor: alice._id,
        type: "release_published",
        message: "alice published release v1.1.0 — Security & Refresh Tokens",
        relatedEntity: mimirCore._id,
        entityModel: "Repository",
        read: true,
        createdAt: new Date("2026-09-20T10:00:00Z"),
      },
    ]);
    console.log("Notifications created.");

    // 9. Activity Logs
    await ActivityLog.insertMany([
      { user: alice._id,   repository: mimirCore._id, action: "commit_created", metadata: { sha: c1.sha.slice(0,8),         message: "Initial commit",                        filesChanged: 2 }, entityId: c1._id,  entityModel: "Commit", createdAt: new Date("2026-09-01T09:00:00Z") },
      { user: alice._id,   repository: mimirCore._id, action: "commit_created", metadata: { sha: c2.sha.slice(0,8),         message: "Add Express server and Merkle tree",     filesChanged: 2 }, entityId: c2._id,  entityModel: "Commit", createdAt: new Date("2026-09-05T10:30:00Z") },
      { user: alice._id,   repository: mimirCore._id, action: "commit_created", metadata: { sha: c3.sha.slice(0,8),         message: "docs: update README",                   filesChanged: 1 }, entityId: c3._id,  entityModel: "Commit", createdAt: new Date("2026-09-08T14:00:00Z") },
      { user: bob._id,     repository: mimirCore._id, action: "commit_created", metadata: { sha: c4.sha.slice(0,8),         message: "feat: scaffold auth controller",         filesChanged: 1 }, entityId: c4._id,  entityModel: "Commit", createdAt: new Date("2026-09-09T09:15:00Z") },
      { user: bob._id,     repository: mimirCore._id, action: "commit_created", metadata: { sha: c5.sha.slice(0,8),         message: "feat: add refresh token endpoint",       filesChanged: 1 }, entityId: c5._id,  entityModel: "Commit", createdAt: new Date("2026-09-11T11:00:00Z") },
      { user: charlie._id, repository: mimirCore._id, action: "commit_created", metadata: { sha: c6.sha.slice(0,8),         message: "test: add Merkle tree unit tests",       filesChanged: 1 }, entityId: c6._id,  entityModel: "Commit", createdAt: new Date("2026-09-13T16:30:00Z") },
      { user: alice._id,   repository: mimirCore._id, action: "branch_merged",  metadata: { source: "feature/auth",            target: "main", strategy: "merge" },                               entityId: c7._id,  entityModel: "Commit", createdAt: new Date("2026-09-15T10:00:00Z") },
      { user: charlie._id, repository: mimirCore._id, action: "commit_created", metadata: { sha: c8.sha.slice(0,8),         message: "feat: add DAG traversal utility",        filesChanged: 1 }, entityId: c8._id,  entityModel: "Commit", createdAt: new Date("2026-09-16T12:00:00Z") },
      { user: alice._id,   repository: mimirCore._id, action: "commit_created", metadata: { sha: c9.sha.slice(0,8),         message: "chore: update .gitignore",               filesChanged: 1 }, entityId: c9._id,  entityModel: "Commit", createdAt: new Date("2026-09-20T09:00:00Z") },
      { user: alice._id,   repository: mimirCore._id, action: "branch_merged",  metadata: { source: "hotfix/null-ptr",         target: "main", strategy: "squash" },                              entityId: c10._id, entityModel: "Commit", createdAt: new Date("2026-09-25T11:00:00Z") },
    ]);
    console.log("Activity logs created.");

    console.log("\n=============================================");
    console.log("  Seeding complete!");
    console.log("  alice@example.com   / password123");
    console.log("  bob@example.com     / password123");
    console.log("  charlie@example.com / password123");
    console.log("=============================================\n");

    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
};

seedDB();
