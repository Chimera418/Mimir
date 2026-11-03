import { create } from 'zustand';
import api from '../services/api';

const useRepoStore = create((set, get) => ({
  repos: [],
  currentRepo: null,
  currentBranch: null,
  branches: [],
  fileTree: null,
  files: [],
  currentFile: null,
  commits: [],
  isLoading: false,
  error: null,

  fetchRepos: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/repos');
      set({ repos: res.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch repositories', isLoading: false });
    }
  },

  createRepo: async (name, description, visibility) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/repos', { name, description, visibility });
      set((state) => ({
        repos: [res.data.data.repo, ...state.repos],
        isLoading: false
      }));
      return { success: true, repo: res.data.data.repo };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to create repository';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  fetchRepoDetails: async (owner, name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/repos/${owner}/${name}`);
      const repo = res.data.data.repo;
      const branches = res.data.data.branches;
      set({ 
        currentRepo: repo, 
        branches,
        currentBranch: repo.defaultBranch,
        isLoading: false 
      });
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch repository', isLoading: false });
      return { success: false };
    }
  },

  fetchFileTree: async (owner, name, branch) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/repos/${owner}/${name}/tree/${branch}`);
      set({ 
        fileTree: res.data.data.tree,
        files: res.data.data.files,
        isLoading: false 
      });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch file tree', isLoading: false });
    }
  },

  fetchFileContent: async (owner, name, branch, filePath) => {
    set({ isLoading: true, error: null, currentFile: null });
    try {
      const res = await api.get(`/repos/${owner}/${name}/blob/${branch}/${filePath}`);
      set({ 
        currentFile: res.data.data.fileVersion,
        isLoading: false 
      });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch file content', isLoading: false });
    }
  },

  fetchCommits: async (owner, name, branch) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/repos/${owner}/${name}/commits?branch=${branch}`);
      set({ 
        commits: res.data.data,
        isLoading: false 
      });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch commits', isLoading: false });
    }
  },

  createCommit: async (owner, name, branchName, message, files) => {
    try {
      const res = await api.post(`/repos/${owner}/${name}/commits`, { branchName, message, files });
      return { success: true, commit: res.data.data.commit };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Failed to create commit' };
    }
  },
}));

export default useRepoStore;
