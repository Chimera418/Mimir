# Mímir — MongoDB-Native Version Control System

> **A Git-inspired, distributed version control platform built on the MERN stack and MongoDB.**  
> Designed as a full-featured DBMS academic project demonstrating **ACID Transactions**, **Directed Acyclic Graphs (DAG)**, **Merkle Tree Cryptographic Integrity**, **Optimistic Concurrency Control**, and **Immutable Database Auditing**.

[![Tests](https://img.shields.io/badge/tests-22%20passed-success)](file:///backend/tests/)
[![DBMS](https://img.shields.io/badge/DBMS-Semester%20Project-blue)]()
[![Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20MongoDB-purple)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## Highlights & DBMS Concepts

Mímir demonstrates core database management systems concepts through version control mechanisms:

1. **Tamper-Evident Commit History & Merkle Trees**
   - **Canonical SHA-256 Hashing:** Deterministic JSON serialization with sorted keys, ISO-8601 timestamps, and sorted parent SHAs.
   - **Binary Hash Tree (Merkle Tree):** Bottom-up hashing of repository file snapshots (`SHA-256(path + content)`), uniquely fingerprinting file tree states.
   - **Read-Only Verification:** Audits history without silently regenerating or overwriting hashes.
   - **Tamper Simulation & Self-Healing:** Interactive UI & CLI tools to simulate database-level tampering (`MERKLE_ROOT_MISMATCH`, `COMMIT_HASH_MISMATCH`, `PARENT_LINK_BROKEN`) and restore authentic data.

2. **ACID-Safe Commit Operations & Concurrency Control**
   - **Multi-Document ACID Transactions:** Coordinates writes across `Commit`, `FileVersion`, `File`, and `Branch` within `session.startTransaction({ readConcern: 'snapshot', writeConcern: 'majority' })`.
   - **Dual-Mode Engine:** Native MongoDB replica set transaction support with an automatic **Compensating Rollback Engine** (Saga pattern) for standalone local MongoDB deployments.
   - **Optimistic Concurrency Control (OCC):** Prevents lost updates using atomic conditional writes (`headCommit: expectedParent`), rejecting concurrent branch mutations.
   - **Failure Simulation:** Includes `simulateFailure: true` support to prove atomic rollback and orphan prevention under crash conditions.

3. **Immutable Repository Audit Trail & Non-Destructive Version Recovery**
   - **Repository-Level Auditing:** Dedicated `ActivityLog` collection indexed for range queries (`{ repository: 1, action: 1, createdAt: -1 }`). Logs lifecycle, revert, and security-violation events.
   - **Git-Style Forward-Moving Recovery:** Reverts commits by computing inverse diffs against parent snapshots and generating a new commit ($C_{revert}$). Original history is 100% preserved.

4. **Branch Protection & 3-Way Merge Conflict Detection**
   - **Backend Branch Protection:** Role-based access control (RBAC) preventing unauthorized users from modifying or deleting protected branches.
   - **Lowest Common Ancestor (LCA) Search:** BFS graph traversal on the commit DAG to locate the common merge base.
   - **3-Way Line-Level Differential Merge:** Compares Base, Source, and Target file contents, outputting standard Git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - **In-Browser Conflict Resolution:** Interactive diff editor allowing developers to resolve conflicts before committing and merging.

---

## System Architecture

```mermaid
graph TD
    UI[React 19 Frontend<br/>Vite + Tailwind CSS] -->|HTTPS REST JSON| API[Express API Server<br/>Node.js]
    
    subgraph API Services & Utilities
        API --> AUTH[Auth & RBAC Middleware]
        API --> CS[Commit Service<br/>runInTransaction]
        API --> IS[Integrity Service<br/>Merkle Verification]
        API --> MS[Merge Service<br/>BFS LCA & 3-Way Diff]
        API --> RS[Recovery Service<br/>Inverse Delta Revert]
        API --> TH[Transaction Helper<br/>Replica Set / Compensating Stack]
        API --> MK[merkle.js<br/>SHA-256 & Hash Trees]
    end
    
    subgraph MongoDB Database (17 Collections)
        CS -->|ACID Multi-Doc / OCC| DB[(MongoDB)]
        IS -->|Read-Only Scan| DB
        MS -->|DAG Ancestor Traversal| DB
        RS -->|Forward Commit Write| DB
    end
```

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: v6.0 or higher running locally on port 27017

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/mimir.git
cd mimir

# Install root, backend, and frontend dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure Environment Variables
Create `backend/.env`:
```ini
PORT=5000
MONGO_URI=mongodb://localhost:27017/mimir?retryWrites=false
JWT_SECRET=mimir_super_secret_jwt_key_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
```

Create `frontend/.env`:
```ini
VITE_API_URL=http://localhost:5000/api
```

### 3. Seed Database
Seeds the database with authentic users, repositories, branches, file versions, and a 10-commit DAG with precomputed Merkle roots:
```bash
npm run seed
```

### 4. Run Development Servers
In terminal 1 (Backend):
```bash
cd backend
npm run dev
# Server listening on http://localhost:5000
```

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
# Vite dev server running at http://localhost:5173
```

---

## Automated Testing & Live Viva Demonstrations

### Run Automated Tests (17/17 Passed)
Mímir includes comprehensive automated tests covering all 4 feature groups:
```bash
npm test
```

Test Suites:
- [`backend/tests/integrity.test.js`](file:///backend/tests/integrity.test.js): Deterministic hashing, Merkle verification, content tampering, metadata tampering, DAG link breakage.
- [`backend/tests/acid.test.js`](file:///backend/tests/acid.test.js): Atomicity, simulated failure rollback, OCC lost update prevention, branch protection rules.
- [`backend/tests/audit_recovery.test.js`](file:///backend/tests/audit_recovery.test.js): Audit querying/filtering/sorting, non-destructive forward-moving revert.
- [`backend/tests/conflicts.test.js`](file:///backend/tests/conflicts.test.js): LCA merge base search, 3-way clean merge, Git conflict markers generation.

### Interactive & Scriptable Mímir CLI
Mímir includes a standalone, MongoDB-native terminal shell and CLI tool:
```bash
# Launch interactive REPL shell:
npm run cli

# Or execute commands directly:
npm run cli -- status
npm run cli -- log -n 5
npm run cli -- verify
npm run cli -- acid-test
npm run cli -- lca main feature/auth
npm run cli -- diff feature/auth main
npm run cli -- analytics stats
```

### Run Live Viva CLI Demonstration
For examiners and demonstration presentations:
```bash
npm run demo
```
*Executes all 5 live database scenarios in [`backend/scripts/demo_viva.js`](file:///backend/scripts/demo_viva.js) with real database mutations, formatted ASCII tables, and instant validation.*

For detailed step-by-step viva instructions and examiner questions, see [docs/dbms-viva-guide.md](file:///docs/dbms-viva-guide.md).

---

## API Reference (Key Endpoints)

### Cryptographic Integrity (`/api/integrity`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/repositories/:id/verify?branch=main` | Performs read-only cryptographic verification of repository commit history. |
| `GET` | `/commits/:sha/verify` | Verifies a single commit (Merkle root, SHA-256, and parent links). |
| `POST` | `/repositories/:id/tamper-demo` | *(Demo only)* Injects deliberate tampering into FileVersion, Commit, or Parent references. |
| `POST` | `/repositories/:id/heal-demo` | *(Demo only)* Restores tampered records back to authentic state. |

### Audit Log (`/api/audit`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/repositories/:id?page=1&limit=20&action=...` | Returns paginated, filtered, and sorted audit logs for a repository. |
| `GET` | `/repositories/:id/summary` | Aggregation query returning action distribution statistics. |

### Commits & Version Recovery (`/api/commits`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Creates an atomic commit via `runInTransaction()`. Supports `simulateFailure: true`. |
| `POST` | `/:sha/revert` | Point-in-time recovery creating an inverse delta revert commit. |

### Branches & Protection (`/api/branches`)
| Method | Endpoint | Description |
|---|---|---|
| `PUT` | `/:id/protect` | Enables or disables branch protection (Requires maintainer/owner role). |

### Pull Requests & 3-Way Merge (`/api/pull-requests`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/:id/conflicts` | Performs 3-way line-level diff against LCA common ancestor and detects conflicts. |
| `POST` | `/:id/resolve` | Commits resolved file contents to the source branch. |
| `PUT` | `/:id/merge` | Atomically executes fast-forward or 3-way merge into target branch. |

---

## Documentation Links

- [DBMS Viva & Demonstration Guide](file:///docs/dbms-viva-guide.md): Complete guide for viva examiners, queries, and demo walkthroughs.
- [Technical Documentation](file:///docs/technical-documentation.md): Comprehensive 900+ line technical architecture, collections, and index specifications.
- [ER Diagram](file:///docs/er-diagram.md): Mermaid entity-relationship diagram of all collections.
- [Architecture & C4 Diagrams](file:///docs/architecture.md): Context, Container, and Component diagrams.
