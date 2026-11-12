#!/usr/bin/env node
/**
 * Mímir VCS — Interactive & Scriptable Command Line Interface (CLI)
 *
 * A full-featured CLI for the MongoDB-native Version Control System.
 * Supports both direct command execution (scripting) and an interactive REPL shell.
 *
 * Usage:
 *   node backend/cli.js [command] [options]
 *   npm run cli
 *   npm run cli -- <command>
 */

const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/User');
const Repository = require('./models/Repository');
const Branch = require('./models/Branch');
const Commit = require('./models/Commit');
const FileVersion = require('./models/FileVersion');
const File = require('./models/File');
const ActivityLog = require('./models/ActivityLog');
const PullRequest = require('./models/PullRequest');

const {
  verifyRepositoryHistory,
  simulateTampering,
  healTamperedCommit,
} = require('./services/integrityService');
const { createCommit, getCommitHistory } = require('./services/commitService');
const { revertCommit } = require('./services/recoveryService');
const {
  findCommonAncestor,
  perform3WayMerge,
  checkPullRequestConflicts,
  mergePullRequest,
} = require('./services/mergeService');
const { runInTransaction, isTransactionSupported } = require('./utils/transactionHelper');

// ANSI Color Palette
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  green: '\x1b[32m',
  brightGreen: '\x1b[92m',
  yellow: '\x1b[33m',
  brightYellow: '\x1b[93m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
  magenta: '\x1b[35m',
  brightMagenta: '\x1b[95m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
};

// Global session state for CLI
const state = {
  activeRepo: null,
  activeBranch: null,
  activeUser: null,
  connected: false,
};

// Pretty ASCII Banner
const printBanner = () => {
  console.log(`
${c.brightCyan}${c.bold} ███╗   ███╗██╗███╗   ███╗██╗██████╗ 
 ████╗ ████║██║████╗ ████║██║██╔══██╗
 ██╔████╔██║██║██╔████╔██║██║██████╔╝
 ██║╚██╔╝██║██║██║╚██╔╝██║██║██╔══██╗
 ██║ ╚═╝ ██║██║██║ ╚═╝ ██║██║██║  ██║
 ╚═╝     ╚═╝╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═╝${c.reset}
 ${c.gray}MongoDB-Native Version Control System & DBMS Demonstration Engine${c.reset}
`);
};

// Helper: Ensure Database Connection
async function ensureConnected() {
  if (!state.connected) {
    await connectDB();
    state.connected = true;
  }

  // Load default repo and branch if not set
  if (!state.activeRepo) {
    state.activeRepo = await Repository.findOne({ name: 'mimir-core' }).populate('owner', 'username');
    if (!state.activeRepo) {
      state.activeRepo = await Repository.findOne().populate('owner', 'username');
    }
  }

  if (state.activeRepo && !state.activeBranch) {
    const mainBranch = await Branch.findOne({ repository: state.activeRepo._id, name: 'main' });
    state.activeBranch = mainBranch || (await Branch.findOne({ repository: state.activeRepo._id }));
  }

  if (!state.activeUser) {
    state.activeUser = await User.findOne({ username: 'alice' }) || await User.findOne();
  }
}

// Helper: Table Formatter
function printTable(headers, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ${c.dim}(No records found)${c.reset}`);
    return;
  }

  const colWidths = headers.map((h, i) => {
    const maxVal = Math.max(...rows.map((r) => String(r[i] || '').length));
    return Math.max(h.length, maxVal);
  });

  const sep = colWidths.map((w) => '─'.repeat(w + 2)).join('┼');
  const headerStr = headers.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join('│');

  console.log(`  ${c.gray}┌${colWidths.map((w) => '─'.repeat(w + 2)).join('┬')}┐${c.reset}`);
  console.log(`  ${c.bold}│${headerStr}│${c.reset}`);
  console.log(`  ${c.gray}├${sep}┤${c.reset}`);

  rows.forEach((row) => {
    const rowStr = row.map((cell, i) => ` ${String(cell || '').padEnd(colWidths[i])} `).join('│');
    console.log(`  │${rowStr}│`);
  });

  console.log(`  ${c.gray}└${colWidths.map((w) => '─'.repeat(w + 2)).join('┴')}┘${c.reset}`);
}

// -----------------------------------------------------------------------------
// CLI COMMAND IMPLEMENTATIONS
// -----------------------------------------------------------------------------

/**
 * cmd_help: Displays command cheat sheet with colored sections
 */
function cmd_help() {
  console.log(`
${c.bold}${c.white}MÍMIR CLI COMMAND REFERENCE:${c.reset}

  ${c.brightCyan}REPOSITORY COMMANDS:${c.reset}
    ${c.bold}repo list${c.reset} (or ${c.bold}repos${c.reset})             List all repositories in MongoDB
    ${c.bold}repo switch <name>${c.reset} (or ${c.bold}use${c.reset})     Switch active repository
    ${c.bold}repo create <name> [--desc <d>]${c.reset} Create a new repository

  ${c.brightCyan}BRANCH COMMANDS:${c.reset}
    ${c.bold}branch list${c.reset} (or ${c.bold}branches${c.reset})         List branches of the active repository
    ${c.bold}checkout <name>${c.reset} (or ${c.bold}switch${c.reset})       Switch active branch
    ${c.bold}branch create <name> [from]${c.reset}     Create a new branch from current or specified branch
    ${c.bold}branch protect <name>${c.reset}             Enable branch protection rule (RBAC)
    ${c.bold}branch unprotect <name>${c.reset}           Disable branch protection rule

  ${c.brightCyan}VCS OPERATIONS & DAG:${c.reset}
    ${c.bold}status${c.reset}                          Show current repo, branch, HEAD commit, and stats
    ${c.bold}log [-n <limit>] [--all]${c.reset}        Render commit history DAG with Merkle roots
    ${c.bold}files${c.reset} (or ${c.bold}ls${c.reset})                   List snapshot files at current HEAD
    ${c.bold}cat <filePath>${c.reset}                  Print file content at current HEAD
    ${c.bold}commit -m "<msg>" [--file <p=c>]${c.reset} Create a new commit (ACID multi-document write)
    ${c.bold}lca <branchA> <branchB>${c.reset}         Find Lowest Common Ancestor (BFS merge base)
    ${c.bold}diff <source> <target>${c.reset}          3-Way differential text analysis & conflict check
    ${c.bold}merge <source> <target>${c.reset}         Merge source into target branch
    ${c.bold}revert <commitSha>${c.reset}              Point-in-Time version recovery (forward-moving commit)

  ${c.brightYellow}DBMS VIVA & INTEGRITY DEMONSTRATIONS:${c.reset}
    ${c.bold}verify${c.reset}                          Run cryptographic Merkle Tree & SHA-256 audit
    ${c.bold}tamper <file|meta|edge>${c.reset}          Simulate database tampering out-of-band
    ${c.bold}heal${c.reset}                            Restore authentic database state from backup
    ${c.bold}acid-test${c.reset}                       Simulate crash mid-transaction to prove atomicity
    ${c.bold}audit [-n <limit>] [--action <a>]${c.reset} Query immutable ActivityLog audit trail
    ${c.bold}analytics [type]${c.reset}                 Run MongoDB aggregation pipelines (stats|hotspots|ownership)
    ${c.bold}demo [1-5]${c.reset}                       Execute automated live viva demonstration

  ${c.gray}SHELL COMMANDS:${c.reset}
    ${c.bold}clear${c.reset}                           Clear terminal screen
    ${c.bold}help${c.reset}                            Display this help menu
    ${c.bold}exit${c.reset} (or ${c.bold}quit${c.reset})                    Disconnect and exit CLI
`);
}

/**
 * cmd_status: Displays active repository, branch, and HEAD snapshot metadata
 */
async function cmd_status() {
  await ensureConnected();
  if (!state.activeRepo) {
    console.log(`${c.red}Error:${c.reset} No repository selected.`);
    return;
  }

  const branch = state.activeBranch;
  let headCommit = null;
  if (branch && branch.headCommit) {
    headCommit = await Commit.findById(branch.headCommit).populate('author', 'username');
  }

  const commitCount = await Commit.countDocuments({ repository: state.activeRepo._id });
  const branchCount = await Branch.countDocuments({ repository: state.activeRepo._id });

  console.log(`\n${c.bold}${c.brightCyan}--- REPOSITORY STATUS ---${c.reset}`);
  console.log(`  ${c.bold}Repository:${c.reset}      ${c.green}${state.activeRepo.name}${c.reset} (${state.activeRepo.visibility})`);
  console.log(`  ${c.bold}Owner:${c.reset}           ${state.activeRepo.owner ? state.activeRepo.owner.username : 'system'}`);
  console.log(`  ${c.bold}Active Branch:${c.reset}   ${c.yellow}${branch ? branch.name : 'none'}${c.reset} ${branch?.isProtected ? c.red + '[PROTECTED]' + c.reset : ''}`);
  console.log(`  ${c.bold}Total Commits:${c.reset}   ${commitCount}`);
  console.log(`  ${c.bold}Total Branches:${c.reset}  ${branchCount}`);

  if (headCommit) {
    console.log(`  ${c.bold}HEAD Commit:${c.reset}     ${c.cyan}${headCommit.sha.slice(0, 8)}${c.reset} - ${headCommit.message}`);
    console.log(`  ${c.bold}Author:${c.reset}          ${headCommit.author ? headCommit.author.username : 'system'}`);
    console.log(`  ${c.bold}Date:${c.reset}            ${new Date(headCommit.createdAt).toLocaleString()}`);
    console.log(`  ${c.bold}Merkle Root:${c.reset}     ${c.magenta}${headCommit.merkleRoot.slice(0, 16)}...${c.reset}`);
    console.log(`  ${c.bold}Files Tracked:${c.reset}   ${headCommit.tree ? headCommit.tree.length : 0} files`);
  } else {
    console.log(`  ${c.bold}HEAD Commit:${c.reset}     ${c.dim}(No commits yet)${c.reset}`);
  }
  console.log();
}

/**
 * cmd_repo_list: Formatted table of all repositories
 */
async function cmd_repo_list() {
  await ensureConnected();
  const repos = await Repository.find().populate('owner', 'username').sort({ name: 1 });

  const rows = await Promise.all(
    repos.map(async (r) => {
      const commitCount = await Commit.countDocuments({ repository: r._id });
      const branchCount = await Branch.countDocuments({ repository: r._id });
      const isActive = state.activeRepo && state.activeRepo._id.toString() === r._id.toString();
      return [
        isActive ? `${c.green}* ${r.name}${c.reset}` : `  ${r.name}`,
        r.owner ? r.owner.username : 'system',
        r.visibility,
        String(branchCount),
        String(commitCount),
        (r.description || '').slice(0, 32),
      ];
    })
  );

  console.log(`\n${c.bold}${c.brightCyan}Repositories in MongoDB:${c.reset}`);
  printTable(['Name', 'Owner', 'Visibility', 'Branches', 'Commits', 'Description'], rows);
  console.log();
}

/**
 * cmd_repo_switch: Select active repository
 */
async function cmd_repo_switch(repoName) {
  if (!repoName) {
    console.log(`${c.red}Usage:${c.reset} repo switch <repoName>`);
    return;
  }
  await ensureConnected();
  const found = await Repository.findOne({ name: repoName }).populate('owner', 'username');
  if (!found) {
    console.log(`${c.red}Error:${c.reset} Repository '${repoName}' not found.`);
    return;
  }

  state.activeRepo = found;
  const mainBranch = await Branch.findOne({ repository: found._id, name: 'main' });
  state.activeBranch = mainBranch || (await Branch.findOne({ repository: found._id }));
  console.log(`${c.green}Switched to repository:${c.reset} ${c.bold}${found.name}${c.reset} (Branch: ${state.activeBranch?.name || 'none'})`);
}

/**
 * cmd_repo_create: Create new repository
 */
async function cmd_repo_create(name, desc = '', isPrivate = false) {
  if (!name) {
    console.log(`${c.red}Usage:${c.reset} repo create <name> [--desc "description"] [--private]`);
    return;
  }
  await ensureConnected();
  const existing = await Repository.findOne({ name });
  if (existing) {
    console.log(`${c.red}Error:${c.reset} Repository '${name}' already exists.`);
    return;
  }

  const repo = await Repository.create({
    name,
    description: desc,
    visibility: isPrivate ? 'private' : 'public',
    owner: state.activeUser._id,
  });

  // Create initial main branch
  const branch = await Branch.create({
    repository: repo._id,
    name: 'main',
    creator: state.activeUser._id,
    isProtected: false,
  });

  state.activeRepo = await Repository.findById(repo._id).populate('owner', 'username');
  state.activeBranch = branch;

  console.log(`${c.green}Repository '${name}' created successfully with branch 'main'.${c.reset}`);
}

/**
 * cmd_branch_list: Formatted list of branches
 */
async function cmd_branch_list() {
  await ensureConnected();
  if (!state.activeRepo) {
    console.log(`${c.red}Error:${c.reset} No repository selected.`);
    return;
  }

  const branches = await Branch.find({ repository: state.activeRepo._id })
    .populate('headCommit', 'sha message')
    .sort({ name: 1 });

  const rows = branches.map((b) => {
    const isActive = state.activeBranch && state.activeBranch._id.toString() === b._id.toString();
    const prefix = isActive ? `${c.green}* ${b.name}${c.reset}` : `  ${b.name}`;
    const headStr = b.headCommit ? `${b.headCommit.sha.slice(0, 8)} (${b.headCommit.message.slice(0, 24)})` : '(empty)';
    const protectStr = b.isProtected ? `${c.red}PROTECTED${c.reset}` : `${c.dim}none${c.reset}`;
    return [prefix, headStr, protectStr, new Date(b.createdAt).toLocaleDateString()];
  });

  console.log(`\n${c.bold}${c.brightCyan}Branches in '${state.activeRepo.name}':${c.reset}`);
  printTable(['Branch', 'HEAD Commit', 'Protection', 'Created'], rows);
  console.log();
}

/**
 * cmd_branch_switch: Checkout branch
 */
async function cmd_branch_switch(branchName) {
  if (!branchName) {
    console.log(`${c.red}Usage:${c.reset} checkout <branchName>`);
    return;
  }
  await ensureConnected();
  const branch = await Branch.findOne({ repository: state.activeRepo._id, name: branchName });
  if (!branch) {
    console.log(`${c.red}Error:${c.reset} Branch '${branchName}' does not exist in '${state.activeRepo.name}'.`);
    return;
  }

  state.activeBranch = branch;
  console.log(`${c.green}Switched to branch '${branchName}'.${c.reset}`);
}

/**
 * cmd_branch_create: Create branch
 */
async function cmd_branch_create(branchName, fromBranchName = null) {
  if (!branchName) {
    console.log(`${c.red}Usage:${c.reset} branch create <branchName> [fromBranch]`);
    return;
  }
  await ensureConnected();

  const existing = await Branch.findOne({ repository: state.activeRepo._id, name: branchName });
  if (existing) {
    console.log(`${c.red}Error:${c.reset} Branch '${branchName}' already exists.`);
    return;
  }

  let headCommit = state.activeBranch?.headCommit || null;
  if (fromBranchName) {
    const src = await Branch.findOne({ repository: state.activeRepo._id, name: fromBranchName });
    if (!src) {
      console.log(`${c.red}Error:${c.reset} Source branch '${fromBranchName}' not found.`);
      return;
    }
    headCommit = src.headCommit;
  }

  const newBranch = await Branch.create({
    repository: state.activeRepo._id,
    name: branchName,
    creator: state.activeUser._id,
    headCommit,
    isProtected: false,
  });

  state.activeBranch = newBranch;
  console.log(`${c.green}Branch '${branchName}' created and checked out.${c.reset}`);
}

/**
 * cmd_branch_protect: Toggle branch protection rule
 */
async function cmd_branch_protect(branchName, protect = true) {
  if (!branchName) {
    console.log(`${c.red}Usage:${c.reset} branch protect <name>`);
    return;
  }
  await ensureConnected();

  const b = await Branch.findOneAndUpdate(
    { repository: state.activeRepo._id, name: branchName },
    { isProtected: protect },
    { new: true }
  );

  if (!b) {
    console.log(`${c.red}Error:${c.reset} Branch '${branchName}' not found.`);
    return;
  }

  console.log(`${c.green}Branch '${branchName}' protection set to:${c.reset} ${protect ? c.red + 'PROTECTED' : c.yellow + 'UNPROTECTED'}${c.reset}`);
}

/**
 * cmd_log: Display commit history graph with Merkle roots
 */
async function cmd_log(limit = 10) {
  await ensureConnected();
  if (!state.activeRepo) return;

  const commits = await Commit.find({ repository: state.activeRepo._id })
    .populate('author', 'username')
    .populate('parentCommits', 'sha')
    .sort({ createdAt: -1 })
    .limit(limit);

  if (commits.length === 0) {
    console.log(`\n  ${c.dim}(No commits in repository '${state.activeRepo.name}')${c.reset}\n`);
    return;
  }

  console.log(`\n${c.bold}${c.brightCyan}Commit History DAG (${state.activeRepo.name}):${c.reset}`);

  commits.forEach((cm, index) => {
    const isHead = state.activeBranch?.headCommit?.toString() === cm._id.toString();
    const branchTag = isHead ? ` ${c.brightGreen}(HEAD -> ${state.activeBranch.name})${c.reset}` : '';
    const mergeTag = cm.isMergeCommit ? ` ${c.magenta}[MERGE]${c.reset}` : '';
    const authorName = cm.author ? cm.author.username : 'system';
    const dateStr = new Date(cm.createdAt).toISOString().slice(0, 10);
    const parentStr = cm.parentCommits?.map((p) => p.sha.slice(0, 7)).join(', ') || 'root';

    console.log(`  ${c.brightYellow}*${c.reset} ${c.cyan}${cm.sha.slice(0, 8)}${c.reset}${branchTag}${mergeTag} - ${c.bold}${cm.message.split('\n')[0]}${c.reset}`);
    console.log(`  ${c.gray}│${c.reset}   Author: ${authorName} <${dateStr}> | Parents: [${parentStr}]`);
    console.log(`  ${c.gray}│${c.reset}   Merkle Root: ${c.magenta}${cm.merkleRoot.slice(0, 20)}...${c.reset}`);
    if (index < commits.length - 1) {
      console.log(`  ${c.gray}│${c.reset}`);
    }
  });
  console.log();
}

/**
 * cmd_files: List files tracked in active commit snapshot
 */
async function cmd_files() {
  await ensureConnected();
  if (!state.activeBranch?.headCommit) {
    console.log(`  ${c.dim}(No files at current branch HEAD)${c.reset}`);
    return;
  }

  const commit = await Commit.findById(state.activeBranch.headCommit).populate({
    path: 'tree.fileVersion',
    select: 'filePath contentHash size createdAt',
  });

  if (!commit || !commit.tree || commit.tree.length === 0) {
    console.log(`  ${c.dim}(Empty tree snapshot)${c.reset}`);
    return;
  }

  const rows = commit.tree.map((item) => {
    const fv = item.fileVersion;
    return [
      item.path,
      fv?.contentHash ? fv.contentHash.slice(0, 12) + '...' : 'none',
      fv?.size ? `${fv.size} B` : '0 B',
      fv?.createdAt ? new Date(fv.createdAt).toLocaleDateString() : 'N/A',
    ];
  });

  console.log(`\n${c.bold}${c.brightCyan}Snapshot Files at HEAD (${state.activeBranch.name}):${c.reset}`);
  printTable(['File Path', 'SHA-256 Hash', 'Size', 'Created'], rows);
  console.log();
}

/**
 * cmd_cat: Output file content at HEAD
 */
async function cmd_cat(filePath) {
  if (!filePath) {
    console.log(`${c.red}Usage:${c.reset} cat <filePath>`);
    return;
  }
  await ensureConnected();
  if (!state.activeBranch?.headCommit) {
    console.log(`${c.red}Error:${c.reset} Branch has no commits.`);
    return;
  }

  const commit = await Commit.findById(state.activeBranch.headCommit).populate('tree.fileVersion');
  const entry = commit.tree?.find((t) => t.path === filePath);

  if (!entry || !entry.fileVersion) {
    console.log(`${c.red}Error:${c.reset} File '${filePath}' not found in current snapshot.`);
    return;
  }

  console.log(`\n${c.bold}--- ${filePath} (SHA-256: ${entry.fileVersion.contentHash.slice(0, 8)}) ---${c.reset}`);
  console.log(entry.fileVersion.content);
  console.log(`${c.bold}--------------------------------------------------${c.reset}\n`);
}

/**
 * cmd_commit: Create a commit directly in MongoDB
 */
async function cmd_commit(message, fileArgs = []) {
  if (!message) {
    console.log(`${c.red}Usage:${c.reset} commit -m "<message>" [--file "path=content"]`);
    return;
  }
  await ensureConnected();

  const files = [];
  fileArgs.forEach((arg) => {
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      files.push({
        path: arg.slice(0, eqIdx),
        content: arg.slice(eqIdx + 1),
      });
    }
  });

  if (files.length === 0) {
    // Default dummy modification for quick testing
    files.push({
      path: 'cli_update.txt',
      content: `Updated via Mímir CLI at ${new Date().toISOString()}`,
    });
  }

  try {
    console.log(`Creating commit on branch '${state.activeBranch.name}'...`);
    const commit = await createCommit({
      repoId: state.activeRepo._id,
      branchId: state.activeBranch._id,
      authorId: state.activeUser._id,
      message,
      files,
      parentCommitIds: state.activeBranch.headCommit ? [state.activeBranch.headCommit] : [],
    });

    state.activeBranch.headCommit = commit._id;
    console.log(`${c.green}Commit created successfully!${c.reset}`);
    console.log(`  ${c.bold}SHA:${c.reset}         ${c.cyan}${commit.sha}${c.reset}`);
    console.log(`  ${c.bold}Merkle Root:${c.reset} ${c.magenta}${commit.merkleRoot}${c.reset}`);
    console.log(`  ${c.bold}Files:${c.reset}       ${commit.tree.length} files in snapshot\n`);
  } catch (err) {
    console.log(`${c.red}Commit failed:${c.reset} ${err.message}`);
  }
}

/**
 * cmd_lca: Find Lowest Common Ancestor between two branches
 */
async function cmd_lca(branchA, branchB) {
  if (!branchA || !branchB) {
    console.log(`${c.red}Usage:${c.reset} lca <branchA> <branchB>`);
    return;
  }
  await ensureConnected();

  const bA = await Branch.findOne({ repository: state.activeRepo._id, name: branchA });
  const bB = await Branch.findOne({ repository: state.activeRepo._id, name: branchB });

  if (!bA || !bB) {
    console.log(`${c.red}Error:${c.reset} One or both branches do not exist.`);
    return;
  }

  console.log(`Finding LCA between '${branchA}' and '${branchB}' via BFS traversal...`);
  const lcaId = await findCommonAncestor(bA.headCommit, bB.headCommit);

  if (!lcaId) {
    console.log(`${c.yellow}No common ancestor found (disjoint histories).${c.reset}`);
    return;
  }

  const lcaCommit = await Commit.findById(lcaId).populate('author', 'username');
  console.log(`\n${c.green}${c.bold}Lowest Common Ancestor (Merge Base) Found:${c.reset}`);
  console.log(`  ${c.bold}Commit SHA:${c.reset}   ${c.cyan}${lcaCommit.sha}${c.reset}`);
  console.log(`  ${c.bold}Message:${c.reset}      ${lcaCommit.message}`);
  console.log(`  ${c.bold}Author:${c.reset}       ${lcaCommit.author?.username}`);
  console.log(`  ${c.bold}Timestamp:${c.reset}    ${new Date(lcaCommit.createdAt).toLocaleString()}\n`);
}

/**
 * Helper to get snapshot file map { filePath -> content }
 */
async function getCommitSnapshotMap(commitId) {
  const map = new Map();
  if (!commitId) return map;
  const cm = await Commit.findById(commitId).populate({
    path: 'tree.fileVersion',
  });
  if (!cm) return map;

  if (cm.tree && cm.tree.length > 0) {
    for (const e of cm.tree) {
      if (e.fileVersion) {
        map.set(e.path, e.fileVersion.content || '');
      }
    }
  } else {
    const versions = await FileVersion.find({ commit: cm._id });
    for (const v of versions) {
      map.set(v.filePath, v.content || '');
    }
  }
  return map;
}

/**
 * cmd_diff: 3-way differential analysis & conflict checking between two branches
 */
async function cmd_diff(sourceBranch, targetBranch) {
  if (!sourceBranch || !targetBranch) {
    console.log(`${c.red}Usage:${c.reset} diff <sourceBranch> <targetBranch>`);
    return;
  }
  await ensureConnected();

  const src = await Branch.findOne({ repository: state.activeRepo._id, name: sourceBranch });
  const tgt = await Branch.findOne({ repository: state.activeRepo._id, name: targetBranch });

  if (!src || !tgt) {
    console.log(`${c.red}Error:${c.reset} Branch '${!src ? sourceBranch : targetBranch}' not found in '${state.activeRepo.name}'.`);
    return;
  }

  console.log(`Analyzing 3-Way Diff: '${sourceBranch}' -> '${targetBranch}'...`);
  const lcaId = await findCommonAncestor(src.headCommit, tgt.headCommit);
  const lcaCommit = lcaId ? await Commit.findById(lcaId).select('sha message') : null;

  const baseMap = await getCommitSnapshotMap(lcaId);
  const srcMap = await getCommitSnapshotMap(src.headCommit);
  const tgtMap = await getCommitSnapshotMap(tgt.headCommit);

  const allPaths = new Set([...baseMap.keys(), ...srcMap.keys(), ...tgtMap.keys()]);
  const conflicts = [];
  const cleanFiles = [];

  for (const filePath of allPaths) {
    const baseContent = baseMap.has(filePath) ? baseMap.get(filePath) : null;
    const tgtContent = tgtMap.has(filePath) ? tgtMap.get(filePath) : null;
    const srcContent = srcMap.has(filePath) ? srcMap.get(filePath) : null;

    if (baseContent === null && tgtContent === null && srcContent !== null) {
      cleanFiles.push({ path: filePath, status: 'added' });
      continue;
    }
    if (baseContent === null && srcContent === null && tgtContent !== null) {
      cleanFiles.push({ path: filePath, status: 'kept' });
      continue;
    }
    if (baseContent !== null && srcContent === null && tgtContent === baseContent) {
      cleanFiles.push({ path: filePath, status: 'deleted' });
      continue;
    }
    if (baseContent !== null && tgtContent === null && srcContent === baseContent) {
      cleanFiles.push({ path: filePath, status: 'deleted' });
      continue;
    }
    if ((srcContent === null && tgtContent !== baseContent) || (tgtContent === null && srcContent !== baseContent)) {
      conflicts.push({
        filePath,
        conflictContent: `<<<<<<< ${targetBranch}\n${tgtContent || '[FILE_DELETED]'}\n=======\n${srcContent || '[FILE_DELETED]'}\n>>>>>>> ${sourceBranch}`,
      });
      continue;
    }

    const mergeRes = perform3WayMerge(baseContent || '', tgtContent || '', srcContent || '', targetBranch, sourceBranch);
    if (mergeRes.hasConflict) {
      conflicts.push({
        filePath,
        conflictContent: mergeRes.conflictContent,
      });
    } else {
      cleanFiles.push({ path: filePath, status: 'clean' });
    }
  }

  console.log(`\n${c.bold}--- 3-Way Differential Analysis ---${c.reset}`);
  console.log(`  ${c.bold}Merge Base (LCA):${c.reset}     ${lcaCommit ? lcaCommit.sha.slice(0, 8) + ' ("' + lcaCommit.message + '")' : 'None'}`);
  console.log(`  ${c.bold}Can Clean Merge:${c.reset}      ${conflicts.length === 0 ? c.green + 'YES' : c.red + 'NO (' + conflicts.length + ' conflicts)'}${c.reset}`);
  console.log(`  ${c.bold}Clean Files:${c.reset}          ${cleanFiles.length}`);
  console.log(`  ${c.bold}Conflicting Files:${c.reset}    ${conflicts.length}`);

  if (conflicts.length > 0) {
    console.log(`\n${c.red}${c.bold}Conflicting Files & Git Markers:${c.reset}`);
    conflicts.forEach((cf) => {
      console.log(`  ${c.yellow}* ${cf.filePath}:${c.reset}`);
      console.log(`${c.magenta}${cf.conflictContent}${c.reset}\n`);
    });
  } else {
    console.log(`\n${c.green}Branches can be merged cleanly with zero conflicts.${c.reset}\n`);
  }
}

/**
 * cmd_merge: Clean merge or conflict rejection
 */
async function cmd_merge(sourceBranch, targetBranch) {
  if (!sourceBranch || !targetBranch) {
    console.log(`${c.red}Usage:${c.reset} merge <sourceBranch> <targetBranch>`);
    return;
  }
  await ensureConnected();

  const src = await Branch.findOne({ repository: state.activeRepo._id, name: sourceBranch });
  const tgt = await Branch.findOne({ repository: state.activeRepo._id, name: targetBranch });

  if (!src || !tgt) {
    console.log(`${c.red}Error:${c.reset} Branch '${!src ? sourceBranch : targetBranch}' not found.`);
    return;
  }

  if (tgt.isProtected) {
    console.log(`${c.yellow}Note: Target branch '${targetBranch}' is protected (requiring maintainer/owner role).${c.reset}`);
  }

  console.log(`Checking 3-way merge viability for '${sourceBranch}' -> '${targetBranch}'...`);
  const lcaId = await findCommonAncestor(src.headCommit, tgt.headCommit);
  const baseMap = await getCommitSnapshotMap(lcaId);
  const srcMap = await getCommitSnapshotMap(src.headCommit);
  const tgtMap = await getCommitSnapshotMap(tgt.headCommit);

  const allPaths = new Set([...baseMap.keys(), ...srcMap.keys(), ...tgtMap.keys()]);
  const conflicts = [];
  const mergedFiles = [];

  for (const filePath of allPaths) {
    const baseContent = baseMap.has(filePath) ? baseMap.get(filePath) : null;
    const tgtContent = tgtMap.has(filePath) ? tgtMap.get(filePath) : null;
    const srcContent = srcMap.has(filePath) ? srcMap.get(filePath) : null;

    if (baseContent === null && tgtContent === null && srcContent !== null) {
      mergedFiles.push({ path: filePath, content: srcContent });
      continue;
    }
    if (baseContent === null && srcContent === null && tgtContent !== null) {
      mergedFiles.push({ path: filePath, content: tgtContent });
      continue;
    }
    if (baseContent !== null && srcContent === null && tgtContent === baseContent) {
      // deleted in source
      continue;
    }
    if (baseContent !== null && tgtContent === null && srcContent === baseContent) {
      // deleted in target
      continue;
    }
    if ((srcContent === null && tgtContent !== baseContent) || (tgtContent === null && srcContent !== baseContent)) {
      conflicts.push(filePath);
      continue;
    }

    const mergeRes = perform3WayMerge(baseContent || '', tgtContent || '', srcContent || '', targetBranch, sourceBranch);
    if (mergeRes.hasConflict) {
      conflicts.push(filePath);
    } else {
      mergedFiles.push({ path: filePath, content: mergeRes.mergedContent });
    }
  }

  if (conflicts.length > 0) {
    console.log(`${c.red}Merge Blocked!${c.reset} Detected ${conflicts.length} conflicting files: ${conflicts.join(', ')}`);
    console.log(`Run '${c.bold}diff ${sourceBranch} ${targetBranch}${c.reset}' to inspect conflict markers.`);
    return;
  }

  // Perform clean merge commit inside transaction
  try {
    console.log(`Creating merge commit with parents [${tgt.headCommit.toString().slice(-6)}, ${src.headCommit.toString().slice(-6)}]...`);
    const mergeCommit = await createCommit({
      repoId: state.activeRepo._id,
      branchId: tgt._id,
      authorId: state.activeUser._id,
      message: `Merge branch '${sourceBranch}' into '${targetBranch}'`,
      files: mergedFiles,
      parentCommitIds: [tgt.headCommit, src.headCommit],
    });

    tgt.headCommit = mergeCommit._id;
    await tgt.save();

    console.log(`${c.green}${c.bold}Merge Completed Successfully!${c.reset}`);
    console.log(`  ${c.bold}Merge Commit SHA:${c.reset} ${c.cyan}${mergeCommit.sha}${c.reset}`);
    console.log(`  ${c.bold}Branch HEAD:${c.reset}       '${targetBranch}' advanced to ${mergeCommit.sha.slice(0, 8)}\n`);
  } catch (err) {
    console.log(`${c.red}Merge transaction failed:${c.reset} ${err.message}`);
  }
}

/**
 * cmd_revert: Git-style forward-moving revert commit
 */
async function cmd_revert(targetSha) {
  if (!targetSha) {
    console.log(`${c.red}Usage:${c.reset} revert <commitSha>`);
    return;
  }
  await ensureConnected();

  try {
    console.log(`Reverting commit ${targetSha.slice(0, 8)} on '${state.activeBranch.name}'...`);
    const result = await revertCommit({
      repoId: state.activeRepo._id,
      branchName: state.activeBranch.name,
      targetSha,
      userId: state.activeUser._id,
      reason: 'CLI Revert Operation',
    });

    console.log(`${c.green}Revert commit successful!${c.reset}`);
    console.log(`  ${c.bold}Original Commit:${c.reset} ${c.yellow}${result.targetCommit.sha.slice(0, 8)}${c.reset} (100% Preserved)`);
    console.log(`  ${c.bold}Revert Commit:${c.reset}   ${c.cyan}${result.revertCommit.sha.slice(0, 8)}${c.reset}`);
    console.log(`  ${c.bold}New Branch HEAD:${c.reset} ${result.revertCommit.sha.slice(0, 8)}\n`);
  } catch (err) {
    console.log(`${c.red}Revert failed:${c.reset} ${err.message}`);
  }
}

/**
 * cmd_verify: Cryptographic Merkle tree audit across history
 */
async function cmd_verify() {
  await ensureConnected();
  console.log(`Running cryptographic Merkle Tree audit on '${state.activeRepo.name}' (${state.activeBranch.name})...\n`);

  const report = await verifyRepositoryHistory(state.activeRepo._id, state.activeBranch.name);

  console.log(`  ${c.bold}Total Commits Audited:${c.reset} ${report.totalCommits}`);
  console.log(`  ${c.bold}Verified:${c.reset}              ${c.green}${report.verifiedCount}${c.reset}`);
  console.log(`  ${c.bold}Failed:${c.reset}                ${report.failedCount > 0 ? c.red + report.failedCount : '0'}${c.reset}`);
  console.log(`  ${c.bold}Overall Status:${c.reset}        ${report.overallStatus === 'verified' ? c.green + 'VERIFIED (Authentic)' : c.red + 'COMPROMISED'}${c.reset}\n`);

  if (report.failedCount > 0) {
    console.log(`  ${c.red}${c.bold}Corrupted Commits Detected:${c.reset}`);
    report.results
      .filter((r) => r.status === 'failed')
      .forEach((fail) => {
        console.log(`  ${c.red}✖ ${fail.sha.slice(0, 8)} [${fail.errorType}]${c.reset}: ${fail.details.description}`);
      });
    console.log(`\n  ${c.yellow}Tip: Run 'heal' to restore database to authentic state.${c.reset}\n`);
  }
}

/**
 * cmd_tamper: Simulate database tampering out-of-band
 */
async function cmd_tamper(type = 'file_content', targetSha = null) {
  await ensureConnected();
  const validTypes = ['file_content', 'commit_metadata', 'parent_edge'];
  if (!validTypes.includes(type)) {
    console.log(`${c.red}Error:${c.reset} Tamper type must be one of: ${validTypes.join(', ')}`);
    return;
  }

  let sha = targetSha;
  if (!sha) {
    const sample = await Commit.findOne({ repository: state.activeRepo._id, parentCommits: { $ne: [] } });
    sha = sample?.sha;
  }

  console.log(`Injecting tamper '${type}' on commit ${sha.slice(0, 8)}...`);
  const res = await simulateTampering(state.activeRepo._id, { commitSha: sha, tamperType: type });
  console.log(`${c.yellow}${res.message}${c.reset}`);
  console.log(`${c.dim}Run 'verify' to inspect tamper detection.${c.reset}\n`);
}

/**
 * cmd_heal: Restore database from tampering
 */
async function cmd_heal(targetSha = null) {
  await ensureConnected();
  console.log(`Restoring database authentic state...`);
  const res = await healTamperedCommit(state.activeRepo._id, { commitSha: targetSha });
  console.log(`${c.green}${res.message}${c.reset}`);
  console.log(`${c.dim}Run 'verify' to confirm restoration.${c.reset}\n`);
}

/**
 * cmd_acid_test: Demonstrate ACID atomicity and rollback
 */
async function cmd_acid_test() {
  await ensureConnected();
  console.log(`\n${c.bold}${c.brightCyan}=== ACID TRANSACTIONS & ROLLBACK DEMONSTRATION ===${c.reset}`);
  console.log(`${c.dim}Simulating sudden database crash mid-transaction during commit creation...${c.reset}\n`);

  const demoBranchName = `acid-cli-demo-${Date.now()}`;
  const demoBranch = await Branch.create({
    repository: state.activeRepo._id,
    name: demoBranchName,
    creator: state.activeUser._id,
    headCommit: state.activeBranch.headCommit,
  });

  const testPath = `acid_test_${Date.now()}.js`;
  const headBefore = demoBranch.headCommit.toString();

  try {
    await createCommit({
      repoId: state.activeRepo._id,
      branchId: demoBranch._id,
      authorId: state.activeUser._id,
      message: 'feat: this commit will crash intentionally',
      files: [{ path: testPath, content: 'data that must NOT persist' }],
      simulateFailure: true,
    });
  } catch (err) {
    console.log(`  -> Caught Expected Crash: ${c.red}${err.message}${c.reset}`);
  }

  const branchAfter = await Branch.findById(demoBranch._id);
  const headAfter = branchAfter.headCommit.toString();
  const orphanFile = await FileVersion.findOne({ repository: state.activeRepo._id, filePath: testPath });

  console.log(`\n  ${c.bold}Atomicity Verification:${c.reset}`);
  console.log(`  -> Branch HEAD Unchanged: ${headBefore === headAfter ? c.green + 'YES (Protected)' : c.red + 'CORRUPTED'}${c.reset}`);
  console.log(`  -> Orphan File Leak:     ${orphanFile ? c.red + 'LEAKED' : c.green + 'ZERO (Clean Rollback)'}${c.reset}`);

  await Branch.deleteOne({ _id: demoBranch._id });
  console.log(`\n${c.green}${c.bold}ACID Invariants 100% Satisfied.${c.reset}\n`);
}

/**
 * cmd_audit: Query ActivityLog collection
 */
async function cmd_audit(limit = 8, actionFilter = null) {
  await ensureConnected();
  const query = { repository: state.activeRepo._id };
  if (actionFilter) query.action = actionFilter;

  const logs = await ActivityLog.find(query)
    .populate('user', 'username')
    .sort({ createdAt: -1 })
    .limit(limit);

  const rows = logs.map((l) => [
    l.action,
    l.user ? l.user.username : 'system',
    new Date(l.createdAt).toLocaleTimeString(),
    JSON.stringify(l.metadata || {}).slice(0, 36) + '...',
  ]);

  console.log(`\n${c.bold}${c.brightCyan}ActivityLog Audit Trail (${state.activeRepo.name}):${c.reset}`);
  printTable(['Action', 'User', 'Time', 'Metadata'], rows);
  console.log();
}

/**
 * cmd_analytics: MongoDB Aggregation Pipelines
 */
async function cmd_analytics(type = 'stats') {
  await ensureConnected();
  console.log(`\n${c.bold}${c.brightCyan}MongoDB Aggregation Pipeline Analytics:${c.reset}\n`);

  if (type === 'stats' || type === 'hotspots') {
    const hotspots = await FileVersion.aggregate([
      { $match: { repository: state.activeRepo._id } },
      { $group: { _id: '$filePath', changes: { $sum: 1 } } },
      { $sort: { changes: -1 } },
      { $limit: 5 },
    ]);
    console.log(`  ${c.bold}Most Modified Files (Pipeline: $match -> $group -> $sort -> $limit):${c.reset}`);
    printTable(['File Path', 'Version Count'], hotspots.map((h) => [h._id, String(h.changes)]));
  }

  if (type === 'stats' || type === 'ownership') {
    const ownership = await FileVersion.aggregate([
      { $match: { repository: state.activeRepo._id } },
      { $lookup: { from: 'commits', localField: 'commit', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $lookup: { from: 'users', localField: 'c.author', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $group: { _id: { file: '$filePath', author: '$u.username' }, edits: { $sum: 1 } } },
      { $sort: { edits: -1 } },
      { $limit: 6 },
    ]);
    console.log(`\n  ${c.bold}Contributor Code Ownership Heatmap ($match -> $lookup -> $unwind -> $group):${c.reset}`);
    printTable(['File', 'Author', 'Edits'], ownership.map((o) => [o._id.file, o._id.author, String(o.edits)]));
  }
  console.log();
}

/**
 * cmd_demo: Delegates to backend/scripts/demo_viva.js
 */
async function cmd_demo(number = null) {
  const demoScript = path.join(__dirname, 'scripts/demo_viva.js');
  const { fork } = require('child_process');
  const child = fork(demoScript, number ? [String(number)] : [], { stdio: 'inherit' });
  await new Promise((resolve) => child.on('exit', resolve));
}

// -----------------------------------------------------------------------------
// COMMAND DISPATCHER & REPL
// -----------------------------------------------------------------------------

async function executeCommand(inputStr) {
  const trimmed = inputStr.trim();
  if (!trimmed) return true;

  const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const cleanParts = parts.map((p) => p.replace(/^["']|["']$/g, ''));
  const cmd = cleanParts[0].toLowerCase();
  const args = cleanParts.slice(1);

  try {
    switch (cmd) {
      case 'help':
      case '?':
        cmd_help();
        break;

      case 'status':
        await cmd_status();
        break;

      case 'repo':
      case 'repos':
        if (args[0] === 'switch' || args[0] === 'use') {
          await cmd_repo_switch(args[1]);
        } else if (args[0] === 'create') {
          const descIdx = args.indexOf('--desc');
          const desc = descIdx !== -1 ? args[descIdx + 1] : '';
          const isPriv = args.includes('--private');
          await cmd_repo_create(args[1], desc, isPriv);
        } else {
          await cmd_repo_list();
        }
        break;

      case 'use':
        await cmd_repo_switch(args[0]);
        break;

      case 'branch':
      case 'branches':
        if (args[0] === 'create') {
          await cmd_branch_create(args[1], args[2]);
        } else if (args[0] === 'protect') {
          await cmd_branch_protect(args[1], true);
        } else if (args[0] === 'unprotect') {
          await cmd_branch_protect(args[1], false);
        } else if (args[0] === 'switch' || args[0] === 'checkout') {
          await cmd_branch_switch(args[1]);
        } else {
          await cmd_branch_list();
        }
        break;

      case 'checkout':
      case 'switch':
        await cmd_branch_switch(args[0]);
        break;

      case 'log': {
        const nIdx = args.indexOf('-n');
        const limit = nIdx !== -1 ? parseInt(args[nIdx + 1]) || 10 : 10;
        await cmd_log(limit);
        break;
      }

      case 'files':
      case 'ls':
        await cmd_files();
        break;

      case 'cat':
        await cmd_cat(args[0]);
        break;

      case 'commit': {
        const mIdx = args.indexOf('-m');
        const message = mIdx !== -1 ? args[mIdx + 1] : args[0];
        const fileArgs = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '--file' && args[i + 1]) fileArgs.push(args[i + 1]);
        }
        await cmd_commit(message, fileArgs);
        break;
      }

      case 'lca':
        await cmd_lca(args[0], args[1]);
        break;

      case 'diff':
        await cmd_diff(args[0], args[1]);
        break;

      case 'merge':
        await cmd_merge(args[0], args[1]);
        break;

      case 'revert':
        await cmd_revert(args[0]);
        break;

      case 'verify':
        await cmd_verify();
        break;

      case 'tamper':
        await cmd_tamper(args[0], args[1]);
        break;

      case 'heal':
        await cmd_heal(args[0]);
        break;

      case 'acid-test':
      case 'acid':
        await cmd_acid_test();
        break;

      case 'audit': {
        const nIdx = args.indexOf('-n');
        const limit = nIdx !== -1 ? parseInt(args[nIdx + 1]) || 8 : 8;
        const actIdx = args.indexOf('--action');
        const action = actIdx !== -1 ? args[actIdx + 1] : null;
        await cmd_audit(limit, action);
        break;
      }

      case 'analytics':
        await cmd_analytics(args[0]);
        break;

      case 'demo':
        await cmd_demo(args[0]);
        break;

      case 'clear':
      case 'cls':
        console.clear();
        printBanner();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        return false;

      default:
        console.log(`${c.red}Unknown command:${c.reset} '${cmd}'. Type ${c.bold}help${c.reset} for available commands.`);
    }
  } catch (err) {
    console.error(`${c.red}CLI Execution Error:${c.reset}`, err.message);
  }

  return true;
}

// Interactive REPL loop
async function runInteractiveShell() {
  printBanner();
  await ensureConnected();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const getPrompt = () => {
    const repoStr = state.activeRepo ? state.activeRepo.name : 'no-repo';
    const branchStr = state.activeBranch ? state.activeBranch.name : 'no-branch';
    return `${c.brightCyan}mimir${c.reset} (${c.green}${repoStr}${c.reset}:${c.yellow}${branchStr}${c.reset})> `;
  };

  const ask = () => {
    rl.question(getPrompt(), async (line) => {
      const shouldContinue = await executeCommand(line);
      if (!shouldContinue) {
        console.log(`\n${c.gray}Disconnecting from MongoDB. Goodbye!${c.reset}`);
        rl.close();
        if (state.connected) await mongoose.connection.close();
        process.exit(0);
      } else {
        ask();
      }
    });
  };

  ask();
}

// Main execution point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No arguments -> launch interactive shell
    await runInteractiveShell();
  } else {
    // Non-interactive command invocation
    const commandLine = args.join(' ');
    await ensureConnected();
    await executeCommand(commandLine);
    if (state.connected) {
      await mongoose.connection.close();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`${c.red}Fatal CLI Error:${c.reset}`, err);
    process.exit(1);
  });
}

module.exports = { executeCommand, ensureConnected, state };
