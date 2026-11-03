# Mímir VCS — DBMS Viva & Live Demonstration Guide

> **Academic Project Evaluation Guide**  
> **Course:** Database Management Systems (DBMS)  
> **Project:** Mímir — A Git-Inspired Version Control System on MongoDB  
> **Tech Stack:** Node.js / Express, MongoDB / Mongoose, React 19, Vite, Tailwind CSS, SHA-256  

---

## 1. Executive Summary & DBMS Concept Mapping

Mímir translates classical version control mechanisms into modern Database Management System (DBMS) primitives:

| Version Control Concept | Database / Distributed Systems Concept | Mímir Implementation |
|---|---|---|
| **Commit Creation** | Multi-Document ACID Transaction | `runInTransaction()` in [`transactionHelper.js`](file:///backend/utils/transactionHelper.js) across `Commit`, `FileVersion`, `File`, and `Branch` |
| **Commit Graph** | Directed Acyclic Graph (DAG) | `parentCommits: [ObjectId]` adjacency list array in MongoDB documents |
| **Commit Integrity** | Cryptographic Hashing & Merkle Trees | Deterministic canonical JSON SHA-256 + binary hash tree in [`merkle.js`](file:///backend/utils/merkle.js) |
| **Lost Update Prevention** | Optimistic Concurrency Control (OCC) | Conditional atomic write `Branch.updateOne({ _id, headCommit: expectedParent })` |
| **Audit Trail** | Write-Once-Read-Many (WORM) Auditing | Immutable `ActivityLog` collection with compound and single-field B-tree indexes |
| **Version Recovery** | Non-Destructive Inverse Delta Snapshot | Forward-moving revert commits computing inverse diffs against parent |
| **Branch Protection** | Role-Based Access Control (RBAC) & Invariant Checking | Backend gatekeeper validating repository membership before transaction commits |
| **Merge Base Resolution** | Graph LCA (Lowest Common Ancestor) | Breadth-First Search (BFS) graph traversal over parent edges |
| **Merge Conflicts** | 3-Way Differential Text Analysis | Line-level diff comparing Base, Source, and Target with Git conflict markers |

---

## 2. MongoDB Deployment & Transaction Modes

### 2.1 Multi-Document ACID Transactions (Replica Set Mode)
MongoDB supports native multi-document distributed transactions when running on a replica set (or Atlas cluster).
- **Session API:** `session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { level: 'majority' } })`
- **Snapshot Isolation:** Reads inside the transaction reflect a single point-in-time snapshot of the database.
- **Atomic Abort:** If an error occurs, `session.abortTransaction()` discards all uncommitted modifications across all collections.

#### How to Enable Replica Set Locally (Windows PowerShell):
```powershell
# Stop standalone MongoDB service
net stop MongoDB

# Start mongod with replica set name rs0
mongod --dbpath "C:\data\db" --replSet rs0 --port 27017

# In a separate terminal or mongosh:
mongosh --eval "rs.initiate()"
```

### 2.2 Standalone Fallback & Compensating Rollback
When running on a single standalone MongoDB instance (without a replica set), native transactions throw `Transactions are not supported by this deployment`. Mímir features an automatic **Compensating Rollback Engine** in [`transactionHelper.js`](file:///backend/utils/transactionHelper.js):
- Automatically detects replica set availability via `isTransactionSupported()`.
- If unsupported, provides an emulated session tracking registered compensation functions (LIFO stack).
- Upon exception, executes compensating operations:
  1. Restores `Branch.headCommit` to its original parent commit.
  2. Removes newly created `Commit` and `FileVersion` documents.
  3. Reverts file deletion markers.
- **Viva Point:** This proves an understanding of Saga patterns and compensating transactions in distributed systems where native 2-Phase Commit (2PC) is unavailable.

---

## 3. The 5 Live Viva Demonstrations

You can execute all 5 demonstrations automatically via the CLI or interactively through the Web UI.

### Running the CLI Demonstration:
```powershell
npm run demo
```
*(Runs [`backend/scripts/demo_viva.js`](file:///backend/scripts/demo_viva.js) with live database mutations, colored output, and ASCII tables).*

---

### DEMO 1: Tamper-Evident Commit History & Cryptographic Verification

#### DBMS Concepts:
- Cryptographic SHA-256 Hashing
- Merkle Trees (Binary Hash Trees)
- Directed Acyclic Graph (DAG) integrity
- Read-Only Auditing (Never silently overwriting hashes)

#### Technical Walkthrough:
1. **Canonical Commit Hashing:**
   In [`backend/utils/merkle.js`](file:///backend/utils/merkle.js), `computeCommitHash` serializes a canonical JSON object where all keys are sorted alphabetically:
   ```json
   {"author":"<id>","merkle_root":"<sha>","message":"...","parents":["<sha1>","<sha2>"],"timestamp":"2026-10-25T08:00:00.000Z"}
   ```
   Sorted parent hashes and ISO timestamps ensure that serialization is 100% deterministic across operating systems and runtimes.
2. **Bottom-Up Merkle Tree:**
   Each file in the commit is transformed into a leaf: `SHA-256("${path}:${content}")`. Leaves are sorted alphabetically by path, paired, and hashed iteratively until a single 64-character `merkleRoot` remains.
3. **Verification Algorithm:**
   [`integrityService.js`](file:///backend/services/integrityService.js) checks:
   - `MERKLE_ROOT_MISMATCH`: File content in MongoDB modified out-of-band.
   - `COMMIT_HASH_MISMATCH`: Commit metadata (message, timestamp, author) altered.
   - `PARENT_LINK_BROKEN`: An edge in the DAG was deleted or severed.

#### Live Execution Steps (Web UI):
1. Navigate to: `http://localhost:5173/alice/mimir-core/integrity`
2. Click **Run Integrity Audit**. Observe **10/10 Commits Verified** (Status: `VERIFIED`).
3. Under **Viva Tamper Simulation & Healing Panel**:
   - Select failure mode: `tamper_file` (File Content Tamper).
   - Click **Inject Tamper into Database**.
   - Observe immediate toast alert indicating unauthorized change written to MongoDB.
4. Click **Run Integrity Audit** again:
   - System flags the exact commit in red with `COMPROMISED`.
   - Failure type displayed: `MERKLE_ROOT_MISMATCH`.
   - Shows Expected Root vs Recalculated Root.
5. In the Tamper Panel, click **Heal & Restore Database**:
   - Re-running the audit returns status to `VERIFIED`.

---

### DEMO 2: ACID Transactions & Atomic Rollback under Simulated Crash

#### DBMS Concepts:
- **Atomicity:** All writes (Commit + FileVersions + Files + Branch HEAD) succeed or none persist.
- **Consistency:** Database state transitions only from one valid DAG state to another.
- **Isolation (OCC):** Optimistic Concurrency Control prevents lost updates on branch HEAD.
- **Durability:** Writes committed to disk with write concern `{ w: 'majority' }`.

#### Technical Walkthrough:
In [`backend/services/commitService.js`](file:///backend/services/commitService.js), a commit write requires:
1. Validating branch existence and protection rules.
2. Checking Optimistic Concurrency Control: verifying that the branch's current `headCommit` matches `expectedParentCommitId`.
3. Inserting `FileVersion` documents for modified files.
4. Constructing the new snapshot tree inheriting unchanged parent files.
5. Calculating Merkle tree root and deterministic commit SHA.
6. Inserting the `Commit` document.
7. Updating `Branch.headCommit` atomically.
8. Writing an `ActivityLog` audit document.

If `simulateFailure: true` is passed (simulating server crash, disk full, or power outage right after file creation), the transaction aborts:
- No orphaned `FileVersion` or `Commit` remains in MongoDB.
- `Branch.headCommit` remains unchanged.

#### Live Execution Steps (CLI & mongosh):
1. Run `npm run demo` and observe **DEMO 2** logs:
   - Creates a demo branch at head commit.
   - Triggers commit with `simulateFailure = true`.
   - Catches `SIMULATED_ACID_FAILURE`.
   - Verifies `headCommit` did NOT advance and 0 orphan documents exist.

---

### DEMO 3: Immutable Repository Audit Trail & Query Execution

#### DBMS Concepts:
- Write-Once-Read-Many (WORM) Auditing
- Compound B-tree Indexes for Range & Equality Filtering
- MongoDB Aggregation Pipeline (`$group`, `$sort`)
- Non-repudiation

#### Technical Walkthrough:
The `ActivityLog` collection records all security-critical operations:
- Actions: `commit_created`, `branch_created`, `branch_merged`, `branch_protected`, `branch_unprotected`, `commit_reverted`, `integrity_verified`, `security_violation`.
- Schema fields: `repository`, `user`, `action`, `metadata` (containing branch, SHA, failure types), and `createdAt`.
- Optimized via Compound Index: `{ repository: 1, action: 1, createdAt: -1 }`.

#### Live Execution Steps (Web UI):
1. Navigate to: `http://localhost:5173/alice/mimir-core/audit`
2. Test Filter by Action: select `commit_reverted` or `integrity_verified`.
3. Search by term: filter logs by SHA or username.
4. Verify pagination controls: switch between pages.
5. Notice that ordinary users have no UI buttons or API endpoints to edit or delete audit logs.

---

### DEMO 4: Version Recovery (Preserving Immutable DAG History)

#### DBMS Concepts:
- Point-in-Time Snapshot Recovery
- Delta Inversion
- Immutable History Invariant (No `DELETE /commits` or history rewriting)

#### Technical Walkthrough:
Traditional naive recovery attempts to delete commits backwards or alter branch pointers, which breaks cryptographic hash chaining and causes data loss.
Mímir's [`recoveryService.js`](file:///backend/services/recoveryService.js) implements **Git Revert**:
1. Locates the target commit to revert ($C_T$) and its parent commit ($C_P$).
2. Compares the snapshot tree of $C_T$ with $C_P$ to compute inverse file deltas:
   - If a file was added in $C_T$, the inverse operation deletes it.
   - If a file was modified in $C_T$, the inverse operation restores the parent's version.
   - If a file was deleted in $C_T$, the inverse operation restores it.
3. Creates a brand new forward-moving commit ($C_{revert}$) with message `Revert "<original message>"`.
4. Appends $C_{revert}$ to the DAG, advancing branch HEAD. History is 100% preserved.

#### Live Execution Steps (Web UI):
1. Navigate to commit history or click any commit: `http://localhost:5173/alice/mimir-core/commits`
2. Open commit detail: e.g. `1134cb1c` ("docs: update README with Getting Started guide").
3. Click the amber button **Revert Commit**.
4. Confirm in the modal dialog.
5. You are redirected to the new forward-moving revert commit.
6. Open the commit history graph: observe both the original commit AND the revert commit in the timeline!

---

### DEMO 5: Branch Protection & 3-Way Merge Conflict Detection

#### DBMS Concepts:
- Role-Based Access Control (RBAC)
- Graph Lowest Common Ancestor (LCA) via BFS
- 3-Way Differential Text Analysis
- Merge Conflict Resolution Safeguards

#### Technical Walkthrough:
1. **Branch Protection Enforcement:**
   Protected branches have `isProtected: true`. In [`branchController.js`](file:///backend/controllers/branchController.js) and [`commitService.js`](file:///backend/services/commitService.js), direct writes or deletions check user role in `RepositoryMember`. If the user is a `developer` (not `maintainer` or `owner`), the request is rejected with HTTP 403 and logged as `security_violation` in `ActivityLog`.
2. **Lowest Common Ancestor (LCA) Search:**
   [`mergeService.js`](file:///backend/services/mergeService.js) uses Breadth-First Search (BFS) to traverse parent pointers from both `sourceBranch` HEAD and `targetBranch` HEAD to find their most recent common ancestor commit ($C_{LCA}$).
3. **3-Way Differential Merge:**
   For each file present in either branch:
   - **Base:** Content at $C_{LCA}$
   - **Source:** Content at Source HEAD
   - **Target:** Content at Target HEAD
   - If only Source changed: cleanly take Source.
   - If only Target changed: cleanly keep Target.
   - If both changed identically: cleanly keep change.
   - If both modified the same lines differently: generate standard Git conflict markers:
     ```text
     <<<<<<< target-branch
     Target branch line content
     =======
     Source branch line content
     >>>>>>> source-branch
     ```
4. **Merge Safeguard:**
   A Pull Request with conflicts disables the **Merge PR** button on both frontend and backend (`HTTP 409 Conflict`). The user must resolve conflicts first.

#### Live Execution Steps (Web UI):
1. Navigate to: `http://localhost:5173/alice/mimir-core/pulls/1`
2. Observe the conflict banner:
   - Displays: *"Cannot automatically merge. 1 file has conflicting edits with target branch."*
   - Shows affected file: `src/index.js`.
3. Inspect the In-Browser Conflict Editor:
   - View the generated `<<<<<<< main`, `=======`, `>>>>>>> feature/user-auth` conflict markers.
4. Edit the file directly in the editor to resolve the conflict (e.g., combining both imports).
5. Click **Resolve Conflicts & Commit**:
   - Writes a resolution commit.
   - Conflicts clear and the **Merge PR** button turns purple and enabled!

---

## 4. Sample MongoDB Inspection Queries (mongosh)

During your viva, open a terminal with `mongosh` to show the examiner the actual documents and indexes:

```javascript
// Connect to database
use mimir;

// 1. Inspect Commits in the DAG
db.commits.find(
  {}, 
  { sha: 1, message: 1, parentCommits: 1, merkleRoot: 1, createdAt: 1 }
).sort({ createdAt: -1 }).pretty();

// 2. Inspect a Commit's Full Snapshot Tree
db.commits.findOne(
  { sha: "2242f4de81bebf86a7d6560411d3d63c46b5a3712b77aa1a9762145b253b2161" },
  { sha: 1, message: 1, "tree.path": 1, merkleRoot: 1 }
);

// 3. Inspect Branch Pointers (HEAD commit)
db.branches.find({}, { name: 1, isProtected: 1, headCommit: 1 }).pretty();

// 4. Query Audit Log by Action and User
db.activitylogs.find(
  { action: { $in: ["commit_reverted", "integrity_verified", "security_violation"] } }
).sort({ createdAt: -1 }).limit(5).pretty();

// 5. Inspect Indexes on Commits and ActivityLog
db.commits.getIndexes();
db.activitylogs.getIndexes();

// 6. Aggregate Activity Distribution (GROUP BY action)
db.activitylogs.aggregate([
  { $group: { _id: "$action", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);
```

---

## 5. Potential Viva Questions & Model Answers

### Q1: Why use SHA-256 and Merkle Trees instead of just hashing the entire folder as a single ZIP?
**Answer:** A Merkle tree gives us **sub-tree verification** and **efficient deduplication**. If only 1 file out of 10,000 files changes in a commit, we only hash that single file and compute $O(\log N)$ intermediate hashes to obtain the new `merkleRoot`. Furthermore, by storing individual file version hashes, unchanged files point to existing `FileVersion` records, saving storage.

### Q2: How does Mímir prevent the Lost Update anomaly when two developers commit simultaneously?
**Answer:** We implement **Optimistic Concurrency Control (OCC)** at the branch level. When updating the branch head in MongoDB, we perform a conditional atomic update:
```javascript
Branch.updateOne(
  { _id: branchId, headCommit: expectedParentCommitId },
  { $set: { headCommit: newCommitId } }
);
```
If two clients submit commits concurrently based on the same parent, only the first update matches `headCommit: expectedParentCommitId` and succeeds (`matchedCount === 1`). The second client receives `matchedCount === 0`, causing the transaction to abort and throw a `409 Conflict: Branch head has moved`.

### Q3: What is the limitation of cryptographic hash chaining in a database, and how does Mímir address it?
**Answer:** While SHA-256 hash chaining ensures tamper-evidence, an attacker with full database write access could theoretically rewrite a commit *and* recalculate all descendant commit hashes down the chain. Without an external cryptographic trust anchor (such as a digital signature with an asymmetric private key, or anchoring the root hash to a public blockchain or Git tag), database-level hash chaining detects unintentional data corruption and localized unauthorized changes, but cannot prevent whole-history recalculation. We have explicitly documented this trust boundary.

### Q4: How does Mímir guarantee ACID properties on MongoDB?
**Answer:**
- **Atomicity:** Using `session.startTransaction()` on replica sets or our custom LIFO compensating rollback stack on standalone instances. If any write to `FileVersion`, `File`, `Commit`, or `Branch` fails, all created documents are cleanly unwritten.
- **Consistency:** Database invariants (such as parent references in the DAG and branch head integrity) are verified before and during write execution.
- **Isolation:** Read Concern `snapshot` guarantees that queries within the transaction read a consistent point-in-time snapshot, preventing dirty reads and non-repeatable reads.
- **Durability:** Write Concern `{ w: 'majority' }` ensures acknowledged commits are stored in memory and on disk journal across replica set nodes.
