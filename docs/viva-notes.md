# Mímir Viva Preparation Notes

## 1. How does the version control system work at the database level?
Instead of storing delta patches (like standard SVN) or flat files in a local `.git` folder, Mímir implements a Git-like **Directed Acyclic Graph (DAG)** using MongoDB. 
- Every `Commit` represents a complete snapshot of the repository.
- File contents are hashed using SHA-256 (to deduplicate identical file contents over time).
- A `Commit` has an array of `parentCommits`. By traversing these parents backwards, we can reconstruct the full history of the repository.

## 2. Why use MongoDB for a Version Control System?
MongoDB's document model perfectly fits the hierarchical and deeply nested nature of file trees and commit graphs.
- We can embed arrays of FileVersion pointers directly inside a Commit document.
- JSON-like flexibility allows us to easily add varied metadata to commits or files.
- MongoDB's Aggregation Framework allows us to compute complex repository analytics (e.g., most modified files, contributor stats) in a single optimized query on the server side.

## 3. How did you ensure data integrity during a commit?
A commit operation requires touching multiple collections: `Commit`, `Branch`, `File`, and `FileVersion`. 
To guarantee ACID properties and ensure we don't end up with an orphaned commit or broken branch pointer, we used **MongoDB Multi-Document Transactions** (`session.startTransaction()`). If any part of the commit process fails (e.g., branch validation fails), the entire transaction aborts.

## 4. How are you handling file deduplication?
In `merkle.js`, every file's content is hashed via SHA-256 (`computeContentHash`). If the same file content is uploaded multiple times, we can detect the identical hash. In a full production scale, this allows us to point `FileVersion` documents to a single shared blob storage reference, mirroring Git's blob storage model.

## 5. Explain your Analytics Dashboard aggregation queries.
The analytics dashboard relies heavily on the MongoDB Aggregation Pipeline:
- **Most Modified Files:** We use `$match` to filter `FileVersions` by repository, then `$group` by `filePath` and use `$sum: 1` to count changes, followed by a `$sort` and `$limit` to find the top 10.
- **Commit Timeline:** We use `$group` alongside the `$dateToString` operator to group commits by their specific Year-Month-Day creation dates, generating a timeline chart.

## 6. How is the Merkle Tree utilized?
We ported the Python Merkle Tree logic into `utils/merkle.js`. When a commit is created, all files in that commit are hashed, and those hashes are recursively paired and hashed again to generate a single `merkleRoot`. This root hash uniquely identifies the exact state of the entire repository tree, ensuring cryptographic integrity.

## 7. What indexes did you use to optimize queries?
- **Compound Indexes:** `{ repository: 1, name: 1 }` on the Branches collection to enforce unique branch names per repo and speed up branch lookups.
- **Text Indexes:** We added `$text` indexes on Commits (`message`), Repositories (`name`, `description`), and Issues (`title`, `body`) to allow for full-text global search across the platform.
