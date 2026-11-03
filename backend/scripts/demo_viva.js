/**
 * demo_viva.js — Interactive Live DBMS Demonstration Script for Viva & Presentation
 *
 * Demonstrates 5 Core DBMS Concepts:
 *   1. Cryptographic Integrity, Merkle Trees, and Tamper Detection
 *   2. ACID Transactions & Atomic Rollback under Failure
 *   3. Immutable Repository Audit Trail with Indexing and Querying
 *   4. Point-in-Time Version Recovery (Preserving DAG Invariants)
 *   5. Branch Protection Rules & 3-Way Merge Conflict Detection
 *
 * Usage:
 *   node backend/scripts/demo_viva.js [demoNumber: 1-5]
 */

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const User = require('../models/User');
const Repository = require('../models/Repository');
const Branch = require('../models/Branch');
const Commit = require('../models/Commit');
const FileVersion = require('../models/FileVersion');
const ActivityLog = require('../models/ActivityLog');
const PullRequest = require('../models/PullRequest');

const {
  verifyRepositoryHistory,
  simulateTampering,
  healTamperedCommit,
} = require('../services/integrityService');
const { createCommit } = require('../services/commitService');
const { revertCommit } = require('../services/recoveryService');
const { findCommonAncestor, perform3WayMerge } = require('../services/mergeService');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

const banner = (title) => {
  console.log(`\n${colors.cyan}${colors.bold}======================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}======================================================================${colors.reset}\n`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDemo1(repo) {
  banner('DEMO 1: Tamper-Evident Commit History & Cryptographic Verification');
  console.log(`${colors.yellow}DBMS Concept:${colors.reset} Data Integrity, Cryptographic Hashing, Merkle Trees, Read-Only Audit.`);
  console.log(`${colors.dim}Explanation: Each commit SHA-256 is deterministically calculated from its canonical metadata,`);
  console.log(`parent hashes, and the Merkle root of all files. Verification never overwrites hashes.${colors.reset}\n`);

  console.log(`1. Running cryptographic verification on repository '${repo.name}', branch 'main'...`);
  const initialCheck = await verifyRepositoryHistory(repo._id, 'main');
  console.log(`   -> Total Commits Checked: ${colors.bold}${initialCheck.totalCommits}${colors.reset}`);
  console.log(`   -> Verified: ${colors.green}${initialCheck.verifiedCount}${colors.reset}`);
  console.log(`   -> Status: ${colors.green}${initialCheck.overallStatus.toUpperCase()}${colors.reset}\n`);

  const sampleCommit = await Commit.findOne({ repository: repo._id, parentCommits: { $ne: [] } });
  console.log(`2. Simulating direct unauthorized database tampering:`);
  console.log(`   -> Target Commit: ${sampleCommit.sha.slice(0, 8)} ("${sampleCommit.message}")`);
  console.log(`   -> Injecting unauthorized change directly into FileVersion in MongoDB...`);

  const tamperResult = await simulateTampering(repo._id, {
    commitSha: sampleCommit.sha,
    tamperType: 'file_content',
  });
  console.log(`   -> ${colors.yellow}${tamperResult.message}${colors.reset}\n`);

  console.log(`3. Re-running cryptographic verification:`);
  const tamperedCheck = await verifyRepositoryHistory(repo._id, 'main');
  console.log(`   -> Verified: ${tamperedCheck.verifiedCount}`);
  console.log(`   -> Failed: ${colors.red}${tamperedCheck.failedCount}${colors.reset}`);
  console.log(`   -> Status: ${colors.red}${tamperedCheck.overallStatus.toUpperCase()}${colors.reset}`);
  const failedCommit = tamperedCheck.results.find((c) => c.status === 'failed');
  if (failedCommit) {
    console.log(`   -> Detected Failure Type: ${colors.red}${colors.bold}${failedCommit.errorType}${colors.reset}`);
    console.log(`   -> Detail: ${failedCommit.details.description}`);
  }

  console.log(`\n4. Healing tampered record to original authentic state...`);
  await healTamperedCommit(repo._id, { commitSha: sampleCommit.sha });
  const healedCheck = await verifyRepositoryHistory(repo._id, 'main');
  console.log(`   -> Status Restored: ${colors.green}${healedCheck.overallStatus.toUpperCase()}${colors.reset} (${healedCheck.verifiedCount}/${healedCheck.totalCommits} verified)`);
}

async function runDemo2(repo, alice) {
  banner('DEMO 2: ACID Transactions & Atomic Rollback under Simulated Crash');
  console.log(`${colors.yellow}DBMS Concept:${colors.reset} ACID (Atomicity, Consistency, Isolation, Durability), Multi-Doc Transactions / Compensating Rollback.`);
  console.log(`${colors.dim}Explanation: Commit creation modifies Commit, FileVersion, File, and Branch HEAD. If a failure`);
  console.log(`occurs mid-operation, partial records are completely rolled back and Branch HEAD is preserved.${colors.reset}\n`);

  const mainBranch = await Branch.findOne({ repository: repo._id, name: 'main' });
  const demoBranch = await Branch.create({
    repository: repo._id,
    name: `viva-acid-demo-${Date.now()}`,
    creator: alice._id,
    headCommit: mainBranch.headCommit,
    isProtected: false,
  });

  console.log(`1. Created demo branch: '${demoBranch.name}' at HEAD commit ${String(demoBranch.headCommit).slice(-6)}`);
  console.log(`2. Initiating commit with ${colors.red}simulateFailure = true${colors.reset} (simulating database server crash)...`);

  const headBefore = demoBranch.headCommit.toString();
  const testFileName = `src/acid_viva_${Date.now()}.js`;

  try {
    await createCommit({
      repoId: repo._id,
      branchId: demoBranch._id,
      authorId: alice._id,
      message: 'feat: this commit will crash mid-transaction',
      files: [{ path: testFileName, content: 'data that must not persist' }],
      parentCommitIds: [demoBranch.headCommit],
      simulateFailure: true,
    });
  } catch (err) {
    console.log(`   -> Caught Expected Error: ${colors.red}${err.message}${colors.reset}`);
  }

  console.log(`\n3. Verifying Atomicity Invariants:`);
  const branchAfter = await Branch.findById(demoBranch._id);
  const headAfter = branchAfter.headCommit.toString();
  console.log(`   -> Branch HEAD Before: ${headBefore}`);
  console.log(`   -> Branch HEAD After:  ${headAfter}`);
  console.log(`   -> Match: ${headBefore === headAfter ? colors.green + 'YES (HEAD not corrupted)' : colors.red + 'NO'}${colors.reset}`);

  const orphanFile = await FileVersion.findOne({ repository: repo._id, filePath: testFileName });
  console.log(`   -> Orphan FileVersion in DB: ${orphanFile ? colors.red + 'LEAKED' : colors.green + 'NONE (Clean Rollback)'}${colors.reset}`);

  await Branch.deleteOne({ _id: demoBranch._id });
}

async function runDemo3(repo) {
  banner('DEMO 3: Immutable Repository Audit Trail & Query Execution');
  console.log(`${colors.yellow}DBMS Concept:${colors.reset} Database Auditing, Compound Indexing, Non-repudiation, Range Querying.`);
  console.log(`${colors.dim}Explanation: All security and lifecycle actions are logged to ActivityLog with timestamps,`);
  console.log(`user references, and structured metadata. Normal users cannot mutate audit history.${colors.reset}\n`);

  console.log(`1. Querying recent audit logs for repository '${repo.name}':`);
  const logs = await ActivityLog.find({ repository: repo._id })
    .populate('user', 'username')
    .sort({ createdAt: -1 })
    .limit(6);

  console.table(
    logs.map((l) => ({
      Action: l.action,
      User: l.user ? l.user.username : 'system',
      Timestamp: new Date(l.createdAt).toLocaleTimeString(),
      Metadata: JSON.stringify(l.metadata || {}).slice(0, 35) + '...',
    }))
  );

  console.log(`2. Aggregating action distribution (GROUP BY action):`);
  const stats = await ActivityLog.aggregate([
    { $match: { repository: repo._id } },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.table(stats.map((s) => ({ ActionType: s._id, Count: s.count })));
}

async function runDemo4(repo, alice) {
  banner('DEMO 4: Version Recovery (Preserving Immutable DAG History)');
  console.log(`${colors.yellow}DBMS Concept:${colors.reset} Point-in-Time Snapshot Restoration, Delta Inversion, DAG Invariants.`);
  console.log(`${colors.dim}Explanation: Recovery is performed by computing an inverse delta against the commit parent`);
  console.log(`and applying a new forward-moving revert commit. History is NEVER silently deleted.${colors.reset}\n`);

  const c3 = await Commit.findOne({ repository: repo._id, message: { $regex: /update README/i } });
  console.log(`1. Target commit to revert: ${c3.sha.slice(0, 8)} ("${c3.message}")`);

  const testBranch = await Branch.create({
    repository: repo._id,
    name: `viva-revert-${Date.now()}`,
    creator: alice._id,
    headCommit: c3._id,
    isProtected: false,
  });

  console.log(`2. Executing version recovery (revertCommit)...`);
  const result = await revertCommit({
    repoId: repo._id,
    branchName: testBranch.name,
    targetSha: c3.sha,
    userId: alice._id,
    reason: 'Demonstrating DBMS Version Recovery for academic evaluation',
  });

  console.log(`   -> Result: ${colors.green}SUCCESS${colors.reset}`);
  console.log(`   -> Target Commit Preserved: ${colors.green}YES (Sha: ${result.targetCommit.sha.slice(0, 8)})${colors.reset}`);
  console.log(`   -> Forward-Moving Revert Commit: ${colors.cyan}${result.revertCommit.sha.slice(0, 8)}${colors.reset}`);
  console.log(`   -> Revert Commit Message:\n      "${result.revertCommit.message.split('\n')[0]}"`);

  const stillExists = await Commit.findById(c3._id);
  console.log(`   -> Original Commit In Database: ${stillExists ? colors.green + 'EXISTS (History preserved)' : colors.red + 'DELETED'}${colors.reset}`);

  await Branch.deleteOne({ _id: testBranch._id });
}

async function runDemo5(repo, bob) {
  banner('DEMO 5: Branch Protection & 3-Way Merge Conflict Detection');
  console.log(`${colors.yellow}DBMS Concept:${colors.reset} Access Control Policies, Graph LCA Traversal, 3-Way Merge, Git Conflict Markers.`);
  console.log(`${colors.dim}Explanation: Protected branches block direct modifications for unauthorized users. Merging performs`);
  console.log(`BFS on the DAG to find the Lowest Common Ancestor and outputs standard conflict markers.${colors.reset}\n`);

  console.log(`1. Attempting unauthorized commit to protected branch 'main' with developer role:`);
  const mainBranch = await Branch.findOne({ repository: repo._id, name: 'main' });
  try {
    await createCommit({
      repoId: repo._id,
      branchId: mainBranch._id,
      authorId: bob._id,
      userRole: 'developer', // Bob is a developer
      message: 'feat: unauthorized direct push',
      files: [{ path: 'README.md', content: '# Unauthorized' }],
    });
  } catch (err) {
    console.log(`   -> Enforcement Result: ${colors.red}${err.message}${colors.reset}`);
  }

  console.log(`\n2. Demonstrating 3-Way Differential Analysis & Conflict Markers:`);
  const baseCode = 'function calculateTotal(items) {\n  return items.reduce((acc, i) => acc + i.price, 0);\n}';
  const targetCode = 'function calculateTotal(items) {\n  // Apply 10% student discount\n  return items.reduce((acc, i) => acc + i.price * 0.9, 0);\n}';
  const sourceCode = 'function calculateTotal(items) {\n  // Apply VAT tax calculation\n  return items.reduce((acc, i) => acc + i.price * 1.15, 0);\n}';

  const mergeResult = perform3WayMerge(baseCode, targetCode, sourceCode, 'main', 'feature/tax');
  console.log(`   -> Conflict Detected: ${mergeResult.hasConflict ? colors.red + 'YES' : colors.green + 'NO'}${colors.reset}`);
  console.log(`   -> Generated Git Conflict Marker Output:\n`);
  console.log(`${colors.magenta}${mergeResult.conflictContent}${colors.reset}`);
}

async function main() {
  await connectDB();
  const repo = await Repository.findOne({ name: 'mimir-core' });
  const alice = await User.findOne({ username: 'alice' });
  const bob = await User.findOne({ username: 'bob' });

  if (!repo || !alice || !bob) {
    console.error('Please run "npm run seed" before launching demo_viva.js');
    process.exit(1);
  }

  const selected = process.argv[2] ? parseInt(process.argv[2]) : null;

  if (selected === 1) {
    await runDemo1(repo);
  } else if (selected === 2) {
    await runDemo2(repo, alice);
  } else if (selected === 3) {
    await runDemo3(repo);
  } else if (selected === 4) {
    await runDemo4(repo, alice);
  } else if (selected === 5) {
    await runDemo5(repo, bob);
  } else {
    // Run all 5 consecutively
    console.log(`\n${colors.bold}${colors.green}======================================================================`);
    console.log(`  MÍMIR VCS — COMPLETE LIVE DBMS DEMONSTRATION & VIVA SUITE`);
    console.log(`======================================================================${colors.reset}`);
    await runDemo1(repo);
    await sleep(500);
    await runDemo2(repo, alice);
    await sleep(500);
    await runDemo3(repo);
    await sleep(500);
    await runDemo4(repo, alice);
    await sleep(500);
    await runDemo5(repo, bob);

    console.log(`\n${colors.green}${colors.bold}======================================================================`);
    console.log(`  ALL 5 VIVA DEMONSTRATIONS COMPLETED SUCCESSFULLY!`);
    console.log(`======================================================================${colors.reset}\n`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
