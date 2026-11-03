# Mímir — Implementation Plan

> **DBMS Semester Project** | MongoDB-centric Git-inspired Version Control System
> Tech Stack: React → Express REST API → MongoDB (Mongoose)

---

## Pre-Work: Inspect Existing VCS

Before writing any new code, read and catalog the existing Python VCS at:
- Local: `C:\Users\anees\Desktop\Projects\Version Control System`
- GitHub: https://github.com/Chimera418/Version-Control-System

Modules to extract logic from:
| Python Module | Port To |
|---|---|
| `repository.py` | `services/repositoryService.js` |
| `commit.py` | `services/commitService.js` |
| `merkle_tree.py` | `utils/merkle.js` |
| `visualization.py` | Commit DAG rendering in React |

---

## Phase 1 — Project Scaffolding

- [ ] Create monorepo: `Mimir/backend/` and `Mimir/frontend/`
- [ ] Initialize Node.js + Express backend (`npm init`, install: `express mongoose jsonwebtoken bcryptjs dotenv cors helmet`)
- [ ] Set up Express folder structure:
  ```
  backend/
    config/       ← db.js, env config
    models/       ← all Mongoose schemas
    controllers/  ← request handlers
    routes/       ← Express routers
    services/     ← business logic
    middleware/   ← auth, error, permissions
    validators/   ← request validation
    utils/        ← merkle.js, hash.js, helpers
  ```
- [ ] Initialize React frontend with Vite (`npm create vite@latest frontend -- --template react`)
- [ ] Set up `react-router-dom`, `axios`, state management (Zustand or Context API)
- [ ] Configure `.env` for `MONGO_URI`, `JWT_SECRET`, `PORT`
- [ ] Set up ESLint + Prettier for both projects
- [ ] Connect MongoDB Atlas or local MongoDB instance
- [ ] Verify connection with a health check endpoint `GET /api/health`

---

## Phase 2 — Database Architecture (Database-First)

> This is the most critical phase. The examiner must see real DBMS engineering.

### 2.1 Conceptual ER Design
Draw and document the ER diagram covering all 17 collections and their relationships.

### 2.2 MongoDB Schema Design Decisions
For each collection, decide: **embed** (denormalize) or **reference** (ObjectId link).

| Collection | Embed | Reference |
|---|---|---|
| Users | avatar (string URL) | — |
| Repositories | defaultBranch name | owner (User), members (RepositoryMember) |
| RepositoryMembers | role | repo (Repository), user (User) |
| Branches | — | repo, headCommit, creator |
| Commits | parentCommits[ ] array | repo, branch, author |
| Files | — | repo, latestVersion |
| FileVersions | content (text/binary) | file, commit |
| Tags | — | repo, commit, creator |
| MergeOperations | — | repo, sourceBranch, targetBranch, mergeCommit |
| PullRequests | — | repo, sourceBranch, targetBranch, author, mergeCommit |
| PRComments | — | PR, author |
| Issues | — | repo, author, assignees[ ], labels[ ] |
| IssueComments | — | issue, author |
| Labels | — | repo |
| Releases | — | repo, tag, commit, author |
| ActivityLogs | action, metadata (embed) | repo, user |
| Notifications | message (embed) | recipient, actor |

### 2.3 Implement All Mongoose Models
For every collection, define:
- Fields with types and defaults
- `required`, `unique`, `enum` validators
- `ref` for all ObjectId references
- `timestamps: true` where appropriate
- Instance methods and statics where useful

### 2.4 Index Design
Design indexes based on real query patterns:

| Collection | Index |
|---|---|
| Users | `{ username: 1 }` unique, `{ email: 1 }` unique |
| Repositories | `{ owner: 1, name: 1 }` unique compound |
| Branches | `{ repository: 1, name: 1 }` unique compound |
| Commits | `{ repository: 1, branch: 1 }`, `{ sha: 1 }` unique |
| FileVersions | `{ file: 1, commit: 1 }` |
| Tags | `{ repository: 1, name: 1 }` unique compound |
| ActivityLogs | `{ repository: 1, createdAt: -1 }` |
| Notifications | `{ recipient: 1, read: 1 }` |
| Issues | `{ repository: 1, status: 1 }` |
| PullRequests | `{ repository: 1, status: 1 }` |

### 2.5 Validation Rules
Document all field-level and cross-document constraints.

---

## Phase 3 — Authentication System

- [ ] **User Model** (`models/User.js`)
  - Fields: username, email, passwordHash, avatar, bio, role (admin/user), accountStatus (active/suspended/deleted), lastLogin
  - Pre-save hook: bcrypt hash password
  - Method: `comparePassword()`

- [ ] **Auth Routes** (`routes/auth.js`)
  - `POST /api/auth/register` — validate, hash, create user, return JWT
  - `POST /api/auth/login` — compare hash, update lastLogin, return JWT
  - `POST /api/auth/logout` — client-side token drop (optionally blacklist)

- [ ] **JWT Middleware** (`middleware/auth.js`)
  - Verify token on every protected route
  - Attach `req.user` to request

- [ ] **User Routes** (`routes/users.js`)
  - `GET /api/users/:username` — public profile
  - `PUT /api/users/me` — edit profile
  - `PUT /api/users/me/password` — change password
  - `GET /api/users/me/notifications` — user notifications

- [ ] **Activity logging** on login events

---

## Phase 4 — Repository System

- [ ] **Repository Model** (`models/Repository.js`)
  - Fields: name, description, visibility (public/private), owner, defaultBranch, isArchived, stars, forks

- [ ] **RepositoryMember Model** (`models/RepositoryMember.js`)
  - Fields: repository, user, role (owner/maintainer/developer/viewer)
  - Compound unique index on `{ repository, user }`

- [ ] **Repository Routes** (`routes/repositories.js`)
  - `POST /api/repos` — create (auto-create `main` branch, add owner as member)
  - `GET /api/repos` — list public repos / user's repos
  - `GET /api/repos/:owner/:name` — get repo details
  - `PUT /api/repos/:owner/:name` — rename/update (owner/maintainer only)
  - `DELETE /api/repos/:owner/:name` — delete with full cascade cleanup (transaction)
  - `PUT /api/repos/:owner/:name/archive` — toggle archive
  - `GET /api/repos/:owner/:name/collaborators` — list members
  - `POST /api/repos/:owner/:name/collaborators` — add collaborator
  - `DELETE /api/repos/:owner/:name/collaborators/:userId` — remove collaborator

- [ ] **Permission Middleware** (`middleware/permissions.js`)
  - `requireRole('owner', 'maintainer')` — role-gated middleware factory

- [ ] **Activity logging** on all repository events

---

## Phase 5 — Commit Engine

> Flagship feature. Port SHA-256 and Merkle Tree logic from Python VCS.

- [ ] **Port `merkle.js`** (`utils/merkle.js`)
  - Build Merkle Tree from list of `{ path, content }` objects
  - Compute SHA-256 hash per file, then combine up the tree
  - Return `merkleRoot` string

- [ ] **Port `hash.js`** (`utils/hash.js`)
  - `computeCommitHash(message, parentHashes, merkleRoot, timestamp, authorId)` → SHA-256

- [ ] **Commit Model** (`models/Commit.js`)
  - Fields: repository, branch, parentCommits[ ] (refs), author, message, sha (unique), merkleRoot, timestamp

- [ ] **FileVersion Model** (`models/FileVersion.js`)
  - Fields: repository, file (ref to File), filePath, content, contentHash, commit (ref), versionNumber, fileSize

- [ ] **File Model** (`models/File.js`)
  - Fields: repository, path, latestVersion (ref), isDeleted

- [ ] **Commit Service** (`services/commitService.js`)
  - `createCommit(repoId, branchId, authorId, message, files[])` using **MongoDB Transaction**:
    1. Build Merkle Tree from file contents
    2. Compute commit SHA
    3. `session.startTransaction()`
    4. Insert Commit document
    5. Upsert File documents for each path
    6. Insert FileVersion documents
    7. Update Branch.headCommit
    8. Insert ActivityLog
    9. `session.commitTransaction()`

- [ ] **Commit Routes** (`routes/commits.js`)
  - `POST /api/repos/:owner/:name/commits` — create commit
  - `GET /api/repos/:owner/:name/commits` — list commits (with branch filter, pagination)
  - `GET /api/repos/:owner/:name/commits/:sha` — get single commit with file diff

---

## Phase 6 — Branch Management

- [ ] **Branch Model** (`models/Branch.js`)
  - Fields: repository, name, headCommit, creator, isProtected
  - Compound unique index on `{ repository, name }`

- [ ] **Branch Routes** (`routes/branches.js`)
  - `GET /api/repos/:owner/:name/branches` — list branches
  - `POST /api/repos/:owner/:name/branches` — create branch from commit SHA or branch name
  - `DELETE /api/repos/:owner/:name/branches/:branchName` — delete (not if protected or default)
  - `PUT /api/repos/:owner/:name/branches/:branchName/protect` — toggle protection

---

## Phase 7 — File Versioning & Browser

- [ ] **File Routes** (`routes/files.js`)
  - `GET /api/repos/:owner/:name/tree/:branchName` — list files at branch HEAD
  - `GET /api/repos/:owner/:name/blob/:branchName/*filePath` — get file content at HEAD
  - `GET /api/repos/:owner/:name/history/*filePath` — file commit history
  - `GET /api/repos/:owner/:name/compare/:sha1/:sha2` — diff between two versions

---

## Phase 8 — Pull Requests

- [ ] **PullRequest Model** (`models/PullRequest.js`)
  - Fields: repository, title, description, sourceBranch, targetBranch, author, status (open/merged/closed), mergeCommit, reviewers[ ]

- [ ] **PRComment Model** (`models/PRComment.js`)
  - Fields: pullRequest, author, body, createdAt

- [ ] **MergeOperation Model** (`models/MergeOperation.js`)
  - Fields: repository, sourceBranch, targetBranch, mergeCommit, mergedBy, strategy

- [ ] **Merge Service** (`services/mergeService.js`)
  - `mergePullRequest(prId, userId)` using **MongoDB Transaction**:
    1. Validate PR is open and branches exist
    2. Create merge commit (two parents)
    3. Update target branch HEAD
    4. Update PR status to `merged`, set mergeCommit
    5. Create MergeOperation record
    6. Create Notifications for involved users
    7. Insert ActivityLog

- [ ] **PR Routes** (`routes/pullRequests.js`)
  - `POST /api/repos/:owner/:name/pulls` — open PR
  - `GET /api/repos/:owner/:name/pulls` — list PRs (filter by status)
  - `GET /api/repos/:owner/:name/pulls/:prNumber` — single PR with comments
  - `POST /api/repos/:owner/:name/pulls/:prNumber/comments` — add comment
  - `PUT /api/repos/:owner/:name/pulls/:prNumber/merge` — merge
  - `PUT /api/repos/:owner/:name/pulls/:prNumber/close` — close

---

## Phase 9 — Issues

- [ ] **Label Model** (`models/Label.js`)
- [ ] **Issue Model** (`models/Issue.js`)
  - Fields: repository, title, body, author, assignees[ ], labels[ ], status (open/closed), issueNumber
- [ ] **IssueComment Model** (`models/IssueComment.js`)

- [ ] **Issue Routes** (`routes/issues.js`)
  - CRUD + assign + label + comment + close/reopen

---

## Phase 10 — Tags & Releases

- [ ] **Tag Model** (`models/Tag.js`)
  - Compound unique index on `{ repository, name }`
- [ ] **Release Model** (`models/Release.js`)
- [ ] **Tag/Release Routes** (`routes/tags.js`, `routes/releases.js`)
  - Create, list, delete tags
  - Create releases linked to tags/commits

---

## Phase 11 — Activity Logs & Notifications

- [ ] **ActivityLog Model** (`models/ActivityLog.js`)
  - Fields: user, repository, action (enum), metadata (mixed), createdAt
  - Index: `{ repository: 1, createdAt: -1 }`

- [ ] **Notification Model** (`models/Notification.js`)
  - Fields: recipient, actor, type (enum), message, relatedEntity, entityModel, read, createdAt

- [ ] Insert activity log entries across all services (commit, merge, PR, issue, etc.)
- [ ] Create notifications for: collaborator added, PR opened, PR merged, issue assigned, mention

---

## Phase 12 — Search

- [x] Add MongoDB text indexes:
  - Users: `{ username: 'text', bio: 'text' }`
  - Repositories: `{ name: 'text', description: 'text' }`
  - Commits: `{ message: 'text' }`
  - Files: `{ path: 'text' }`
  - Issues: `{ title: 'text', body: 'text' }`
- [x] `GET /api/search?q=term&type=repos,users,commits,files,issues`

---

## Phase 13 — Analytics (Critical for DBMS Grade)

> All computed server-side using MongoDB aggregation pipelines.

- [x] **Analytics Routes** (`routes/analytics.js`)

| Endpoint | Aggregation Pipeline |
|---|---|
| `GET /api/analytics/commits-per-repo` | `$group` on repository, `$count` |
| `GET /api/analytics/commits-per-user` | `$group` on author, `$count`, populate username |
| `GET /api/analytics/top-contributors` | Sort commits by author count, `$limit 10` |
| `GET /api/analytics/most-modified-files` | `$group` FileVersions by filePath, `$count` |
| `GET /api/analytics/branch-stats` | Count branches per repo |
| `GET /api/analytics/merge-stats` | Count MergeOperations by repo |
| `GET /api/analytics/pr-stats` | `$group` PRs by status |
| `GET /api/analytics/issue-stats` | `$group` Issues by status |
| `GET /api/analytics/repo/:id/timeline` | ActivityLog `$group` by date (`$dateToString`) |
| `GET /api/analytics/user/:id/contributions` | Commits `$group` by date, per user |
| `GET /api/analytics/repo/:id/growth` | Commits count over time (`$bucket` by week/month) |

---

## Phase 14 — Frontend (React)

Build GitHub-quality UI: dark-first, glassmorphism, micro-animations.

### Pages to Build

| Page | Key Features |
|---|---|
| `/` Landing | Hero, feature highlights, CTA |
| `/login` | JWT login form |
| `/register` | Registration form |
| `/dashboard` | User's repos, activity feed, quick actions |
| `/profile/:username` | Avatar, bio, public repos, contribution graph |
| `/:owner/:repo` | Repo overview, README, file tree, stats |
| `/:owner/:repo/tree/:branch` | File browser by branch |
| `/:owner/:repo/blob/:branch/*` | File content viewer |
| `/:owner/:repo/commits/:branch` | Commit timeline list |
| `/:owner/:repo/commit/:sha` | Single commit detail + file diffs |
| `/:owner/:repo/branches` | Branch list + protection status |
| `/:owner/:repo/pulls` | PR list |
| `/:owner/:repo/pulls/:num` | PR detail + comments + merge button |
| `/:owner/:repo/issues` | Issue list |
| `/:owner/:repo/issues/:num` | Issue detail + comments |
| `/:owner/:repo/releases` | Releases list |
| `/:owner/:repo/settings` | Repo settings, collaborators, danger zone |
| `/analytics` | Global + per-repo analytics dashboards |
| `/notifications` | Notification center |
| `/settings` | User account settings |

### Commit Explorer (DAG Visualizer)
- Fetch commit history with parent references
- Render interactive DAG using D3.js or a canvas-based approach
- Show SHA, branch, author, timestamp, merkleRoot on node click

### Component Architecture
```
frontend/src/
  components/   ← reusable: Button, Avatar, Badge, CodeBlock, DiffViewer
  pages/        ← one file per route
  hooks/        ← useAuth, useRepo, useCommits, useAnalytics
  services/     ← api.js (axios instance with interceptors)
  store/        ← auth state (Zustand)
  utils/        ← formatDate, truncateSHA
```

---

## Phase 15 — Seed Data

Generate realistic interconnected seed data (`backend/seeds/seed.js`):

- [ ] 5–10 users with hashed passwords
- [ ] 3–5 repositories per user (public + private)
- [ ] 2–4 branches per repo
- [ ] 20–50 commits per repo with actual file content
- [ ] File versions per commit
- [ ] Pull requests (open, merged, closed)
- [ ] Issues with comments and labels
- [ ] Tags and releases
- [ ] Activity logs for all events
- [ ] Notifications across users

Run with `npm run seed`

---

## Phase 16 — Documentation

Generate alongside development into `Mimir/docs/`:

- [ ] `problem-statement.md`
- [ ] `objectives.md`
- [ ] `architecture.md` (C4 diagrams: Context, Container, Component)
- [ ] `er-diagram.md` (Mermaid ER diagram)
- [ ] `collection-design.md` (all 17 schemas)
- [ ] `index-design.md`
- [ ] `aggregation-pipelines.md`
- [ ] `transactions.md`
- [ ] `api-reference.md`
- [ ] `vcs-integration.md` (how Python VCS was ported)
- [ ] `setup-guide.md`
- [ ] `viva-notes.md` (expected viva questions + answers)

---

## Definition of Done Checklist

- [x] All 17 MongoDB collections implemented with full validation
- [x] All indexes created and verified with `explain()`
- [x] Transactions used for commit creation and branch merging
- [x] Aggregation pipelines power all analytics routes
- [x] JWT auth functional (register/login/protected routes)
- [x] Repositories: CRUD + archive + collaborators
- [x] Branches: create/delete/protect
- [x] Commits: create with Merkle Tree hash, traverse DAG
- [x] File versioning: browse by branch, view history, diff
- [x] Pull Requests: open/review/comment/merge/close
- [x] Issues: CRUD/assign/label/close
- [x] Tags and releases
- [x] Activity logs on all events
- [x] Notifications system
- [x] Indexed search
- [x] Analytics dashboard (all 11 metrics, all via aggregation)
- [x] Seed data populates a realistic demo database
- [x] All frontend pages consume real APIs (no mock data)
- [x] Commit Explorer renders the DAG
- [x] Documentation complete for submission and viva

---

## Milestone Summary

| Phase | Focus | Key Deliverable |
|---|---|---|
| Pre-Work | Read existing VCS | Extracted algorithms |
| 1 | Scaffolding | Runnable backend + frontend shells |
| 2 | DB Architecture | 17 Mongoose models with indexes |
| 3 | Auth | JWT register/login/protected routes |
| 4 | Repositories | Full CRUD + roles + permissions |
| 5 | Commit Engine | SHA-256 + Merkle Tree + transactions |
| 6 | Branches | Branch lifecycle + protection |
| 7 | File Versioning | Browse, history, diff |
| 8 | Pull Requests | Open → merge with transaction |
| 9 | Issues | Tracking + comments + labels |
| 10 | Tags & Releases | Tagging commits |
| 11 | Activity & Notifications | Audit trail + user notifications |
| 12 | Search | Text indexes + unified search endpoint |
| 13 | Analytics | 11 aggregation pipelines + dashboard |
| 14 | Frontend | All pages, DAG visualizer |
| 15 | Seed Data | Demo-ready populated database |
| 16 | Documentation | Submission + viva ready |
