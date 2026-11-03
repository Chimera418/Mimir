# Mímir VCS — Comprehensive Technical Documentation

> **DBMS Semester Project** | A MongoDB-native, Git-inspired Version Control System  
> Stack: React 19 · Node.js / Express · Mongoose · MongoDB

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Connection & Configuration](#3-database-connection--configuration)
4. [MongoDB Schema Design — All 17 Collections](#4-mongodb-schema-design--all-17-collections)
5. [Indexes & Query Optimization](#5-indexes--query-optimization)
6. [Core Feature: The Commit Engine (DAG + Merkle Tree)](#6-core-feature-the-commit-engine-dag--merkle-tree)
7. [ACID Transactions — Where & Why](#7-acid-transactions--where--why)
8. [MongoDB Aggregation Pipelines (Analytics)](#8-mongodb-aggregation-pipelines-analytics)
9. [Full-Text Search](#9-full-text-search)
10. [REST API Reference](#10-rest-api-reference)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Data Flow Walkthroughs](#12-data-flow-walkthroughs)

---

## 1. Project Overview

**Mímir** is a full-stack Version Control System inspired by Git, built entirely on MongoDB. The project demonstrates advanced DBMS concepts including:

- **Document-oriented schema design** for hierarchical data (file trees, commit graphs)
- **Directed Acyclic Graph (DAG)** data structures stored natively as MongoDB documents with `parentCommits[]` arrays
- **Multi-document ACID transactions** for atomic commit and merge operations
- **MongoDB Aggregation Pipelines** powering a live analytics dashboard with 11 computed metrics
- **SHA-256 Merkle Trees** for cryptographic integrity verification of every commit
- **Compound Indexes** and **Text Indexes** for performant querying across millions of documents

### Why MongoDB Instead of a Relational Database?

A Git-like version control system is inherently a **graph problem** — commits reference parent commits, files have version histories, and branches are just named pointers into this graph. Representing these relationships efficiently in a relational (tabular) schema would require complex self-joins on a `commits` table and recursive CTEs, which are both slow and difficult to maintain.

MongoDB's document model is a natural fit:

| VCS Concept | MongoDB Solution |
|---|---|
| Commit DAG (graph of commits) | `parentCommits: [ObjectId]` array on each document |
| File tree snapshot per commit | `tree: [{path, fileVersion}]` embedded array |
| File deduplication | `contentHash` field on `FileVersion` |
| Atomic commit (all-or-nothing) | Multi-document Transaction with `session.startTransaction()` |
| Analytics on commit history | MongoDB Aggregation Pipeline (`$group`, `$bucket`, `$lookup`) |

---

## 2. System Architecture

### C4 — Context Level

```
[ Developer (User) ]
        |
        | HTTPS Browser Requests
        v
[ Mímir VCS Platform ]
  - Create repos, branches, commits
  - Collaborate via Pull Requests and Issues
  - View analytics and history
```

### C4 — Container Level

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React SPA  (Vite, Tailwind CSS, React Router, Zustand)   │  │
│  │  Port: 5173                                               │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────│────────────────────────────────────────┘
                          │  JSON REST API (Axios)
                          │  http://localhost:5000/api
                          v
┌────────────────────────────────────────────────────────────────┐
│               Node.js + Express API Server                     │
│               Port: 5000                                       │
│                                                                │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Routes   │→ │ Controllers │→ │ Services │→ │   Utils   │  │
│  │ (HTTP)   │  │ (req/res)   │  │(business)│  │(merkle.js)│  │
│  └──────────┘  └─────────────┘  └──────────┘  └───────────┘  │
│                                      │                         │
│              ┌───────────────────────┘                         │
│              │  Mongoose ODM                                   │
└──────────────│─────────────────────────────────────────────────┘
               │  MongoDB Wire Protocol
               v
┌────────────────────────────────────────────────────────────────┐
│           MongoDB (localhost / Atlas)                          │
│           Database: mimir                                      │
│                                                                │
│   17 Collections: users, repositories, branches, commits,     │
│   fileversions, files, pullrequests, issues, labels,          │
│   issuecomments, prcomments, mergeoperations, tags,           │
│   releases, activitylogs, notifications, repositorymembers   │
└────────────────────────────────────────────────────────────────┘
```

### Backend Folder Structure

```
backend/
├── config/
│   └── db.js             ← MongoDB connection (Mongoose.connect)
├── controllers/          ← HTTP req/res handlers — thin layer
│   ├── authController.js
│   ├── commitController.js
│   ├── fileController.js
│   ├── analyticsController.js
│   └── ...
├── services/             ← Business logic with DB writes
│   ├── commitService.js  ← Core: Merkle Tree, Transaction, DAG merge
│   ├── mergeService.js   ← PR merge Transaction
│   └── activityService.js
├── models/               ← 17 Mongoose schemas (one per collection)
│   ├── Commit.js
│   ├── FileVersion.js
│   └── ...
├── routes/               ← Express Router definitions
├── middleware/
│   ├── auth.js           ← JWT verification, req.user injection
│   └── permissions.js    ← Role-based access (owner/maintainer/developer)
└── utils/
    ├── merkle.js         ← SHA-256 Merkle Tree implementation
    └── apiResponse.js    ← Standardized JSON envelope helpers
```

---

## 3. Database Connection & Configuration

**File:** [`backend/config/db.js`](file:///c:/Users/anees/Desktop/Sem%205/DBMS/Project/Mimir/backend/config/db.js)

```js
const connectDB = async () => {
  const baseUri = process.env.MONGO_URI.split('?')[0];
  const uri = `${baseUri}?retryWrites=false&directConnection=true`;

  const conn = await mongoose.connect(uri, {
    retryWrites: false,
    directConnection: true,
  });
  console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
};
```

**Key decisions:**

| Option | Value | Reason |
|---|---|---|
| `retryWrites` | `false` | Required for local standalone MongoDB; Atlas replica sets handle this automatically |
| `directConnection` | `true` | Bypasses replica set discovery when connecting to a single local node |
| `MONGO_URI` | `.env` file | Never hardcoded. Connection string is injected at runtime from environment |

The `connectDB()` function is called **once** at server startup in `server.js` before the Express app begins listening. If the connection fails, `process.exit(1)` is called immediately to prevent a server running without a database.

---

## 4. MongoDB Schema Design — All 17 Collections

Mímir's database uses **17 Mongoose models**, each representing an entity in the VCS domain. Every schema follows the principle: **embed for locality, reference for shared data**.

---

### 4.1 `User`

**Purpose:** Stores authentication credentials and public profile information for every registered developer.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `username` | `String` | Unique, lowercase, used as namespace in URLs (e.g., `/abc/repo`) |
| `email` | `String` | Unique, validated regex |
| `passwordHash` | `String` | bcrypt hash of password — never stored in plaintext |
| `role` | `enum ['user','admin']` | Admins can access global analytics |
| `accountStatus` | `enum ['active','suspended','deleted']` | Soft-delete support |
| `lastLogin` | `Date` | Updated on every successful login |

**Indexes:** `{ username: 1 }` unique, `{ email: 1 }` unique, `{ username: 'text', bio: 'text' }` (for global search).

---

### 4.2 `Repository`

**Purpose:** Represents a code repository owned by a user.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `owner` | `ObjectId → User` | The repository creator, always has `owner` role |
| `name` | `String` | URL slug (e.g., `my-project`). Unique per owner |
| `visibility` | `enum ['public','private']` | Controls who can read the repository |
| `defaultBranch` | `String` | Typically `main`. Used as fallback in queries |
| `isArchived` | `Boolean` | Archived repos are read-only |
| `stars`, `forks` | `Number` | Cached counters |

**Indexes:** `{ owner: 1, name: 1 }` unique compound — enforces that the same user cannot create two repos with the same name, and allows `O(log n)` lookup by `/:owner/:name`.

---

### 4.3 `Branch`

**Purpose:** A named pointer to the tip (HEAD) of a chain of commits.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `repository` | `ObjectId → Repository` | Parent repo |
| `name` | `String` | e.g., `main`, `feature/auth` |
| `headCommit` | `ObjectId → Commit` | Pointer to the most recent commit on this branch |
| `isProtected` | `Boolean` | If true, only maintainers/owners can push |
| `isDefault` | `Boolean` | Marks the repository's default branch |

**Design principle:** A branch is intentionally *very lightweight* — it is just a pointer. When a commit is created, the branch's `headCommit` field is updated to point to the new commit. All history is discoverable by walking the `parentCommits` chain from HEAD backwards.

**Indexes:** `{ repository: 1, name: 1 }` unique — one branch name per repo.

---

### 4.4 `Commit` — The DAG Node

**Purpose:** The fundamental unit of the VCS. Each commit represents a snapshot of the entire repository state, linked to its predecessor(s) to form the DAG.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `repository` | `ObjectId → Repository` | Parent repo |
| `branch` | `ObjectId → Branch` | The branch this commit was made on |
| `parentCommits` | `[ObjectId → Commit]` | **DAG edges.** Empty for initial commit, 1 for normal commits, 2 for merge commits |
| `author` | `ObjectId → User` | Who authored the commit |
| `message` | `String` | Human-readable change summary |
| `sha` | `String` (unique) | SHA-256 hash uniquely identifying this commit |
| `merkleRoot` | `String` | Merkle root hash of all files at this commit |
| `isMergeCommit` | `Boolean` | True when `parentCommits.length === 2` |
| `tree` | `[{ path: String, fileVersion: ObjectId }]` | **Full snapshot.** Stores the complete file tree at this commit |

**The `tree` field is the most architecturally important field in the entire system.** It enables O(1) file lookup at any historical point without needing to traverse the entire DAG backwards.

**Indexes:** `{ repository: 1, branch: 1, createdAt: -1 }`, `{ sha: 1 }` unique, `{ message: 'text' }` for search.

---

### 4.5 `File`

**Purpose:** A persistent record of a file path within a repository across all commits. It is the "identity" record for a file — `FileVersion` are the actual snapshots.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `repository` | `ObjectId → Repository` | Parent repo |
| `path` | `String` | Relative file path (e.g., `src/utils/merkle.js`) |
| `latestVersion` | `ObjectId → FileVersion` | Pointer to the most recent `FileVersion` |
| `isDeleted` | `Boolean` | Soft-delete. Set to `true` when a file is committed with `status: 'deleted'` |

---

### 4.6 `FileVersion`

**Purpose:** A snapshot of a single file's content at a specific commit. This is the actual data store — it holds the raw file content.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `file` | `ObjectId → File` | The "identity" file this version belongs to |
| `filePath` | `String` | Denormalized path for fast lookup without populating `File` |
| `content` | `String` | The **full raw content** of the file at this commit |
| `contentHash` | `String` | SHA-256 of `content`. Enables change detection (diff) without reading full content |
| `commit` | `ObjectId → Commit` | The commit that introduced this version |
| `versionNumber` | `Number` | Monotonically increasing (1, 2, 3...) per file |
| `fileSize` | `Number` | Byte count of the content |

**How diff works:** When comparing two commits, the `compareCommits` function builds two maps of `{ filePath → contentHash }`. A changed file is detected by comparing hashes — no string comparison needed.

**Indexes:** `{ file: 1, versionNumber: -1 }`, `{ file: 1, commit: 1 }`, `{ repository: 1, filePath: 1, createdAt: -1 }`.

---

### 4.7 `PullRequest`

**Purpose:** A proposed merge of one branch into another, enabling code review workflows.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `number` | `Number` | Sequential per-repository PR number (like GitHub's #42) |
| `sourceBranch` | `ObjectId → Branch` | The branch with new changes |
| `targetBranch` | `ObjectId → Branch` | The branch to merge into |
| `status` | `enum ['open','merged','closed']` | Lifecycle state |
| `mergeCommit` | `ObjectId → Commit` | Set after merge, points to the merge commit |
| `reviewers` | `[ObjectId → User]` | Array of reviewers assigned |

**Indexes:** `{ repository: 1, number: 1 }` unique compound, `{ repository: 1, status: 1 }` for filtered list queries.

---

### 4.8 `Issue`

**Purpose:** Bug reports, feature requests, and tasks attached to a repository.

**Key fields:** `title`, `body`, `author`, `assignees[]`, `labels[]`, `status (open/closed)`, `issueNumber`.

**Indexes:** `{ repository: 1, status: 1 }`, `{ title: 'text', body: 'text' }` for search.

---

### 4.9 `ActivityLog`

**Purpose:** An immutable append-only audit trail of every significant event in the system. Powers the timeline chart in Analytics.

**Key fields:**

| Field | Type | Notes |
|---|---|---|
| `user` | `ObjectId → User` | Actor who triggered the event |
| `repository` | `ObjectId → Repository` | Repository context |
| `action` | `enum` | e.g., `commit_created`, `pr_opened`, `issue_closed`, `branch_deleted` |
| `metadata` | `Mixed` | Flexible JSON blob — e.g., `{ sha: "abc1234", filesChanged: 3 }` |
| `entityId` | `ObjectId` | Dynamic reference to the affected document |
| `entityModel` | `String` | Model name for the dynamic ref (e.g., `'Commit'`, `'PullRequest'`) |

**Design:** `metadata` uses MongoDB's `Mixed` type deliberately, because different event types carry very different contextual data. A `commit_created` event stores `sha` and `filesChanged`; a `member_added` event stores `newMemberUsername` and `role`.

**Indexes:** `{ repository: 1, createdAt: -1 }` — optimized for time-descending repository feed queries.

---

### 4.10–4.17 Supporting Collections

| Model | Purpose | Key Relationship |
|---|---|---|
| `RepositoryMember` | Maps users to repos with roles (owner/maintainer/developer/viewer) | `{ repository, user }` unique compound |
| `PRComment` | Comments on pull requests | `pullRequest → PullRequest`, `author → User` |
| `IssueComment` | Comments on issues | `issue → Issue`, `author → User` |
| `Label` | Colored tags for issues | `repository → Repository` |
| `MergeOperation` | Audit record of a completed merge | `sourceBranch`, `targetBranch`, `mergeCommit`, `strategy` |
| `Tag` | Named pointers to specific commits (e.g., `v1.0.0`) | `{ repository, name }` unique compound |
| `Release` | A published release associated with a tag | `tag → Tag`, `commit → Commit` |
| `Notification` | User inbox items | `recipient → User`, `actor → User`, polymorphic `relatedEntity` |

---

## 5. Indexes & Query Optimization

Indexes are the primary mechanism for ensuring database queries remain fast as data scales. Mímir uses three categories of indexes:

### 5.1 Single-Field Unique Indexes

```js
// Users — lookup by username in URLs; enforce uniqueness
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

// Commits — SHA is the universal identifier for a commit
commitSchema.index({ sha: 1 }, { unique: true });
```

### 5.2 Compound Indexes (Multi-field)

Compound indexes are used when queries filter by **two or more fields together** — the most common pattern in a repository-scoped application.

```js
// Branch: find a branch by name within a specific repository
branchSchema.index({ repository: 1, name: 1 }, { unique: true });
// → Query: Branch.findOne({ repository: repoId, name: 'main' })

// Commit: get commit history for a branch, newest first
commitSchema.index({ repository: 1, branch: 1, createdAt: -1 });
// → Query: Commit.find({ repository: repoId, branch: branchId }).sort({ createdAt: -1 })

// PullRequest: list open PRs for a repository
pullRequestSchema.index({ repository: 1, status: 1 });
// → Query: PullRequest.find({ repository: repoId, status: 'open' })

// ActivityLog: recent activity feed for a repository
activityLogSchema.index({ repository: 1, createdAt: -1 });
// → Query: ActivityLog.find({ repository: repoId }).sort({ createdAt: -1 }).limit(50)
```

### 5.3 Text Indexes (Full-Text Search)

MongoDB text indexes tokenize string fields and enable efficient keyword search using `$text` operators.

```js
// Repositories: search by name and description
repositorySchema.index({ name: 'text', description: 'text' });

// Commits: search by commit message
commitSchema.index({ message: 'text' });

// Issues: search by title and body
issueSchema.index({ title: 'text', body: 'text' });

// Users: search by username and bio
userSchema.index({ username: 'text', bio: 'text' });
```

**Query pattern using text index:**
```js
Repository.find(
  { $text: { $search: 'authentication jwt' }, visibility: 'public' },
  { score: { $meta: 'textScore' } }
).sort({ score: { $meta: 'textScore' } }).limit(5)
```
This returns results ranked by relevance score — documents where the search term appears more frequently and in more important fields rank higher.

---

## 6. Core Feature: The Commit Engine (DAG + Merkle Tree)

**Files:** [`backend/utils/merkle.js`](file:///c:/Users/anees/Desktop/Sem%205/DBMS/Project/Mimir/backend/utils/merkle.js) · [`backend/services/commitService.js`](file:///c:/Users/anees/Desktop/Sem%205/DBMS/Project/Mimir/backend/services/commitService.js)

### 6.1 Merkle Tree Construction

A Merkle Tree is a binary hash tree where each leaf node is a hash of a file's content, and each parent node is a hash of its two children. The root of the tree (the `merkleRoot`) is a single 64-character SHA-256 string that **uniquely represents the entire state of all files at that moment**. Changing a single byte in any file will produce a completely different `merkleRoot`.

```
           merkleRoot (SHA-256)
               /        \
          H(A+B)        H(C+C)       ← duplicate C when odd count
          /    \        /
         H(A)  H(B)   H(C)
          |     |      |
       file1  file2  file3
```

**Implementation in `merkle.js`:**

```js
const buildMerkleTree = (files) => {
  // 1. Sort files by path — CRITICAL for determinism
  //    Same files must always produce same root, regardless of upload order
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  // 2. Create leaf hashes: SHA-256 of "path:content"
  //    Including the path prevents two files with same content from colliding
  let nodes = sorted.map(f => computeHash(`${f.path}:${f.content}`));

  // 3. Build tree bottom-up — pair and hash until one root remains
  while (nodes.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left;  // duplicate if odd count
      nextLevel.push(computeHash(left + right));
    }
    nodes = nextLevel;
  }

  return nodes[0]; // The merkle root
};
```

### 6.2 Commit SHA Generation

The commit SHA-256 is computed from:

```js
const computeCommitHash = ({ message, parentHashes, merkleRoot, timestamp, authorId }) => {
  const data = JSON.stringify({
    parents: [...parentHashes].sort(), // sorted for merge commit determinism
    merkle_root: merkleRoot,
    message,
    author: authorId,
    timestamp,
  });
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
};
```

This is **deterministic** — the same inputs always produce the same SHA. It is also **collision-resistant** — even a tiny change to any input (one character in the commit message, one byte in any file) produces a completely different 64-character hex hash.

### 6.3 Tree Snapshot Strategy

The **most critical architectural decision** in Mímir is how the commit stores the file tree. Instead of only storing *changed* files, each commit stores a `tree` array containing a pointer to the `FileVersion` of **every file that exists in the repository at that moment**.

```js
// In commitService.js — building the new commit's tree
const treeMap = new Map();

// Step 1: Inherit the parent commit's entire tree
if (parentCommitIds.length > 0) {
  const parentCommit = await Commit.findById(parentCommitIds[0]);
  parentCommit.tree.forEach(t => treeMap.set(t.path, t.fileVersion));
}

// Step 2: Apply the changes from this new commit
for (const fileData of files) {
  if (fileData.status === 'deleted') {
    treeMap.delete(fileData.path);               // Remove from tree
    await File.updateOne({ path: fileData.path }, { isDeleted: true });
  } else {
    const fv = await FileVersion.create({ ...fileData });
    treeMap.set(fileData.path, fv._id);          // Add/update in tree
  }
}

// Step 3: Persist the final snapshot onto the commit document
await Commit.updateOne({ _id: commit._id }, {
  tree: Array.from(treeMap.entries()).map(([path, fvId]) => ({ path, fileVersion: fvId }))
});
```

**Why this matters:** Looking up `"what does file X look like at commit Y?"` is now a single document lookup — `Commit.findById(Y).populate('tree.fileVersion')` — rather than a complex graph traversal backwards through the DAG. This trades storage for read performance, mirroring how Git's object store works.

---

## 7. ACID Transactions — Where & Why

MongoDB supports multi-document ACID transactions since version 4.0. Mímir uses them in two critical flows.

### What ACID Means in Mímir's Context

| Property | How Mímir Implements It |
|---|---|
| **Atomicity** | A commit either saves ALL of its `FileVersion` records AND updates the branch pointer, or saves NONE. There is no partial commit state. |
| **Consistency** | The `Branch.headCommit` pointer always points to a valid, fully-formed `Commit` document. |
| **Isolation** | While a commit transaction is in progress, no other operation can see the intermediate (partial) state. |
| **Durability** | Once the transaction commits, data survives server restarts (written to MongoDB journal). |

### 7.1 Commit Transaction (in `commitService.js`)

```
START TRANSACTION
  ① Build Merkle Tree from file contents
  ② Compute SHA-256 commit hash
  ③ INSERT new Commit document
  ④ For each file:
      - UPSERT File document (create if new path, else update)
      - INSERT FileVersion document
      - UPDATE File.latestVersion pointer
  ⑤ UPDATE Commit.tree snapshot
  ⑥ UPDATE Branch.headCommit → new commit._id
  ⑦ INSERT ActivityLog entry
COMMIT (or ROLLBACK if any step throws)
```

Without a transaction, if the server crashes after step ③ but before step ⑥, the branch HEAD would still point to the old commit while a new, orphaned commit document exists in the database. A user refreshing the page would see no change, but the database would be in an inconsistent state.

### 7.2 Merge Transaction (in `mergeService.js`)

A PR merge is even more complex and touches more collections:

```
START TRANSACTION
  ① Validate PR is 'open' and both branches exist
  ② Create a MERGE COMMIT with two parents
      (parentCommits = [sourceHead, targetHead])
  ③ UPDATE target branch headCommit → merge commit
  ④ UPDATE PullRequest.status = 'merged'
  ⑤ SET PullRequest.mergeCommit, mergedBy, mergedAt
  ⑥ INSERT MergeOperation document
  ⑦ INSERT Notifications for PR author and reviewers
  ⑧ INSERT ActivityLog
COMMIT
```

---

## 8. MongoDB Aggregation Pipelines (Analytics)

**File:** [`backend/controllers/analyticsController.js`](file:///c:/Users/anees/Desktop/Sem%205/DBMS/Project/Mimir/backend/controllers/analyticsController.js)

The analytics dashboard computes all metrics server-side using MongoDB's Aggregation Framework — a multi-stage pipeline that transforms documents. This is the MongoDB equivalent of SQL's `GROUP BY`, `JOIN`, `HAVING`, and window functions combined.

### 8.1 Most Modified Files (per Repository)

**Aggregation:** Group `FileVersion` documents by `filePath`, count how many times each path appears.

```js
FileVersion.aggregate([
  { $match: { repository: req.repo._id } },        // Stage 1: Filter to this repo
  { $group: { _id: '$filePath', changes: { $sum: 1 } } }, // Stage 2: Count per path
  { $sort: { changes: -1 } },                       // Stage 3: Highest first
  { $limit: 10 },                                   // Stage 4: Top 10 only
  { $project: { _id: 0, file: '$_id', changes: 1 } } // Stage 5: Rename _id → file
])
```

**SQL Equivalent:**
```sql
SELECT file_path AS file, COUNT(*) AS changes
FROM file_versions
WHERE repository_id = :repoId
GROUP BY file_path
ORDER BY changes DESC
LIMIT 10;
```

### 8.2 Top Contributors (Global)

**Aggregation:** Count commits per author across all repositories.

```js
Commit.aggregate([
  { $group: { _id: '$author', commits: { $sum: 1 } } }, // Count by author
  { $sort: { commits: -1 } },
  { $limit: 10 },
  { $lookup: {                                           // JOIN to users collection
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'user'
  }},
  { $unwind: '$user' },                                  // Flatten array
  { $project: { _id: 0, username: '$user.username', avatar: '$user.avatar', commits: 1 } }
])
```

The `$lookup` stage performs a **cross-collection join** — equivalent to SQL's `INNER JOIN users ON commits.author_id = users._id`.

### 8.3 Repository Growth Over Time

**Aggregation:** Count commits per calendar month, then compute a running cumulative sum.

```js
Commit.aggregate([
  { $match: { repository: req.repo._id } },
  {
    $group: {
      _id: {
        year: { $year: '$createdAt' },    // Extract year from date
        month: { $month: '$createdAt' }   // Extract month from date
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { '_id.year': 1, '_id.month': 1 } }
])
// Then in JavaScript: compute cumulative total
let total = 0;
const growth = data.map(item => {
  total += item.count;
  return { date: `${item._id.year}-${item._id.month}`, commits: total };
});
```

The `$year` and `$month` are **date aggregation operators** — MongoDB's equivalent of SQL's `EXTRACT(YEAR FROM created_at)`.

### 8.4 Repository Activity Timeline

```js
ActivityLog.aggregate([
  { $match: { repository: req.repo._id } },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      events: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, date: '$_id', events: 1 } },
])
```

`$dateToString` converts a timestamp to a formatted string (e.g., `"2026-09-29"`), allowing grouping by exact calendar day regardless of what hour the activity occurred.

### 8.5 PR and Issue Stats by Status

```js
PullRequest.aggregate([
  { $match: { repository: req.repo._id } },
  { $group: { _id: '$status', count: { $sum: 1 } } },
  // Result: [{ _id: 'open', count: 3 }, { _id: 'merged', count: 12 }]
])
```

The result is then reduced in JavaScript into a friendly object: `{ open: 3, merged: 12, closed: 1 }`.

---

## 9. Full-Text Search

**File:** [`backend/controllers/searchController.js`](file:///c:/Users/anees/Desktop/Sem%205/DBMS/Project/Mimir/backend/controllers/searchController.js)

**Endpoint:** `GET /api/search?q=keyword&type=repos,users,commits,files,issues`

The search system uses MongoDB's built-in **text indexes** to perform relevance-ranked full-text search across five collections simultaneously.

```js
// Five parallel queries run concurrently with Promise.all
await Promise.all([
  User.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(5)
    .select('username avatar bio'),

  Repository.find(
    { $text: { $search: q }, visibility: 'public' },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(5),
  
  // ... Commits, Files, Issues
])
```

**How `$text` works internally:** MongoDB's text index tokenizes and stems each indexed string field when the document is inserted. At query time, the search term is also tokenized. MongoDB computes a **text score** based on term frequency — a document where `"authentication"` appears in both the name and description scores higher than one where it appears only in the description.

---

## 10. REST API Reference

All endpoints return a standard JSON envelope:

```json
{ "success": true, "data": { ... }, "message": "Optional message" }
```

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Register new user, return JWT |
| `POST` | `/api/auth/login` | None | Login, return JWT |
| `GET` | `/api/auth/me` | JWT | Get current authenticated user |

### Repositories

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/repos` | JWT | Create repository (auto-creates `main` branch) |
| `GET` | `/api/repos` | Optional | List public repos |
| `GET` | `/api/repos/:owner/:name` | Optional | Get repo details |
| `PUT` | `/api/repos/:owner/:name` | Owner/Maintainer | Update repo settings |
| `DELETE` | `/api/repos/:owner/:name` | Owner | Delete repo (cascades) |
| `POST` | `/api/repos/:owner/:name/collaborators` | Owner | Add collaborator |

### Commits

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/repos/:owner/:name/commits` | JWT | Create commit (runs Transaction) |
| `GET` | `/api/repos/:owner/:name/commits` | Optional | List commits (paginated, branch filter) |
| `GET` | `/api/repos/:owner/:name/commits/:sha` | Optional | Get single commit + changed files |
| `GET` | `/api/repos/:owner/:name/commits/dag` | Optional | Get full commit DAG for visualization |

### Files

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/repos/:owner/:name/tree/:branch` | Optional | File tree at branch HEAD |
| `GET` | `/api/repos/:owner/:name/blob/:branch/*path` | Optional | File content at HEAD |
| `GET` | `/api/repos/:owner/:name/history/*path` | Optional | Full version history of one file |
| `GET` | `/api/repos/:owner/:name/compare/:sha1/:sha2` | Optional | Diff between two commits |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/global/top-contributors` | Top 10 committers globally |
| `GET` | `/api/analytics/repos/:owner/:name/modified-files` | Most changed files in repo |
| `GET` | `/api/analytics/repos/:owner/:name/branch-stats` | Branch count |
| `GET` | `/api/analytics/repos/:owner/:name/pr-stats` | PR counts by status |
| `GET` | `/api/analytics/repos/:owner/:name/issue-stats` | Issue counts by status |
| `GET` | `/api/analytics/repos/:owner/:name/timeline` | Activity events per day |
| `GET` | `/api/analytics/repos/:owner/:name/growth` | Cumulative commits per month |

---

## 11. Frontend Architecture

**Stack:** React 19, React Router v7, Zustand (state management), Axios (HTTP), Tailwind CSS v4, Lucide React (icons)

### Pages and Routes

| Route | Page Component | Features |
|---|---|---|
| `/` | `Landing.jsx` | Hero, feature highlights, CTA |
| `/login` | `Login.jsx` | JWT login form |
| `/register` | `Register.jsx` | Registration form |
| `/dashboard` | `Dashboard.jsx` | User's repos, quick actions |
| `/:owner/:name` | `RepositoryView.jsx` | File browser, branch switcher, commit modal, links to Network/Analytics/History |
| `/:owner/:name/blob/:branch/*` | `FileViewer.jsx` | File content viewer with syntax |
| `/:owner/:name/commits/:branch` | `CommitHistory.jsx` | Vertical timeline of commits |
| `/:owner/:name/network` | `CommitExplorer.jsx` | **DAG visualizer using HTML5 Canvas** |
| `/:owner/:name/analytics` | `Analytics.jsx` | **Live analytics dashboard** from Aggregation APIs |

### State Management (Zustand)

```
frontend/src/store/
├── authStore.js    ← { user, isAuthenticated, token, login(), logout(), fetchUser() }
└── repoStore.js    ← { currentRepo, commits, fileTree, branches, fetchRepoDetails(), createCommit(), ... }
```

Zustand was chosen over Redux for its zero-boilerplate API — a store is a plain JavaScript object with actions.

### Commit Modal (Frontend → Backend Flow)

The `CommitModal` component inside `RepositoryView.jsx` demonstrates the full request lifecycle:

1. User fills in commit message and adds/uploads files
2. Each file row has a **"Delete" checkbox** — if checked, the file is sent with `status: 'deleted'`
3. On submit: `POST /api/repos/:owner/:name/commits` with body `{ branchName, message, files: [{ path, content, status }] }`
4. Backend `commitService.createCommit()` runs the transaction
5. On success, `fetchFileTree()` is called to refresh the file browser

### DAG Visualizer (`CommitExplorer.jsx`)

The DAG visualizer fetches all commits from `GET /api/repos/:owner/:name/commits/dag` which returns commits with their `parentShas[]` arrays. The component:

1. Assigns each branch a horizontal **column** on an HTML5 Canvas
2. Draws **Bézier curves** between parent and child commits
3. Draws circular **nodes** at each commit's position
4. Overlays a standard React list alongside the canvas with commit metadata

---

## 12. Data Flow Walkthroughs

### Flow A: Creating a Commit

```
User fills CommitModal
  → POST /api/repos/abc/my-repo/commits
    { branchName: "main", message: "Add auth module", files: [...] }

  → commitController.createCommit()
    1. Find branch by name (Branch.findOne)
    2. Check branch protection + user role
    3. Fetch parentCommitIds from branch.headCommit

  → commitService.createCommit()
    1. buildMerkleTree(files) → merkleRoot string
    2. computeCommitHash(...) → sha string
    3. Load parent commit's tree into treeMap (Map<path, fvId>)
    4. Commit.create({ sha, merkleRoot, parentCommits, ... })
    5. For each file:
       - File.findOne or File.create (upsert)
       - FileVersion.create({ content, contentHash, versionNumber })
       - treeMap.set(path, fv._id)
    6. Commit.updateOne → save tree snapshot
    7. Branch.updateOne → headCommit = new commit._id
    8. logActivity(commit_created)

  ← HTTP 201 { commit: { sha, message, author, ... } }

Frontend:
  → fetchFileTree() → GET /api/repos/abc/my-repo/tree/main
    1. Branch.findOne({ name: 'main' }) → headCommit
    2. Commit.findById(headCommit).populate('tree.fileVersion')
    3. Build nested { dir: { children: {} }, file: { path, size } } object
  ← File browser updates with new files visible
```

### Flow B: Merging a Pull Request

```
User clicks "Merge PR"
  → PUT /api/repos/abc/my-repo/pulls/42/merge

  → prController.mergePR()
    → mergeService.mergePullRequest(pr, userId)

  [TRANSACTION START]
    1. Validate PR.status === 'open'
    2. Fetch sourceBranch.headCommit and targetBranch.headCommit
    3. Commit.create({ parentCommits: [sourceHead, targetHead], isMergeCommit: true })
    4. Run tree merge: inherit targetBranch tree, apply source changes on top
    5. Branch.updateOne(targetBranch) → headCommit = mergeCommit._id
    6. PullRequest.updateOne → status='merged', mergeCommit, mergedAt
    7. MergeOperation.create(...)
    8. Notification.create for PR author and reviewers
    9. logActivity(pr_merged)
  [TRANSACTION COMMIT]

  ← HTTP 200 { pr: { status: 'merged', mergeCommit: { sha } } }
```

### Flow C: Browsing the Analytics Dashboard

```
User navigates to /:owner/:name/analytics
  → Analytics.jsx mounts
  → Promise.all([6 concurrent API calls])

  → GET /api/analytics/repos/abc/my-repo/modified-files
    → FileVersion.aggregate([$match, $group, $sort, $limit, $project])
    ← [{ file: "src/auth.js", changes: 47 }, ...]

  → GET /api/analytics/repos/abc/my-repo/growth
    → Commit.aggregate([$match, $group by year+month, $sort])
    → JavaScript: compute cumulative sum
    ← [{ date: "2026-09", commits: 47 }, ...]

  → Analytics.jsx renders stat cards + bar charts + leaderboard
```

---

*Generated for Mímir DBMS Project — Semester 5*  
*Tech Stack: React 19 · Node.js · Express · Mongoose · MongoDB*
