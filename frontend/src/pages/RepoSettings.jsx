import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  Settings as SettingsIcon, 
  Users, 
  ShieldAlert, 
  Archive, 
  Trash2, 
  Save, 
  Plus, 
  UserMinus, 
  Loader2, 
  AlertCircle, 
  Check, 
  ArrowLeft,
  GitBranch,
  Lock,
  Globe
} from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";
import RepoHeader from "../components/RepoHeader";

const RepoSettings = () => {
  const { owner, name } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [collaborators, setCollaborators] = useState([]);

  // Form states
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalSuccess, setGeneralSuccess] = useState("");
  const [generalError, setGeneralError] = useState("");

  // Collaborator states
  const [newCollabUsername, setNewCollabUsername] = useState("");
  const [newCollabRole, setNewCollabRole] = useState("developer");
  const [addingCollab, setAddingCollab] = useState(false);
  const [collabError, setCollabError] = useState("");
  const [collabSuccess, setCollabSuccess] = useState("");

  // Danger zone states
  const [archiving, setArchiving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [repoRes, collabRes, branchRes] = await Promise.all([
        api.get(`/repos/${owner}/${name}`),
        api.get(`/repos/${owner}/${name}/collaborators`).catch(() => ({ data: { data: { members: [] } } })),
        api.get(`/repos/${owner}/${name}/branches`).catch(() => ({ data: { data: { branches: [] } } }))
      ]);

      const r = repoRes.data.data.repo;
      setRepo(r);
      setDescription(r.description || "");
      setVisibility(r.visibility || "public");
      setDefaultBranch(r.defaultBranch || "main");

      const memberList = collabRes.data.data.members || [];
      setCollaborators(memberList);

      const branchList = branchRes.data.data.branches || branchRes.data.data || [];
      setBranches(branchList);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load repository settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [owner, name]);

  const handleUpdateGeneral = async (e) => {
    e.preventDefault();
    setGeneralError("");
    setGeneralSuccess("");
    setSavingGeneral(true);

    try {
      const res = await api.put(`/repos/${owner}/${name}`, {
        description,
        visibility,
        defaultBranch
      });
      setRepo(res.data.data.repo);
      setGeneralSuccess("Repository updated successfully!");
      setTimeout(() => setGeneralSuccess(""), 4000);
    } catch (err) {
      setGeneralError(err.response?.data?.message || "Failed to update repository");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!newCollabUsername.trim()) return;

    setCollabError("");
    setCollabSuccess("");
    setAddingCollab(true);

    try {
      await api.post(`/repos/${owner}/${name}/collaborators`, {
        username: newCollabUsername.trim(),
        role: newCollabRole
      });
      setCollabSuccess(`Added ${newCollabUsername} as ${newCollabRole}`);
      setNewCollabUsername("");
      setTimeout(() => setCollabSuccess(""), 4000);

      // Refresh collaborators
      const res = await api.get(`/repos/${owner}/${name}/collaborators`);
      setCollaborators(res.data.data.members || []);
    } catch (err) {
      setCollabError(err.response?.data?.message || "Failed to add collaborator");
    } finally {
      setAddingCollab(false);
    }
  };

  const handleRemoveCollaborator = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from this repository?`)) {
      return;
    }

    try {
      await api.delete(`/repos/${owner}/${name}/collaborators/${userId}`);
      setCollaborators(prev => prev.filter(c => c.user?._id !== userId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to remove collaborator");
    }
  };

  const handleToggleArchive = async () => {
    const action = repo.isArchived ? "unarchive" : "archive";
    if (!window.confirm(`Are you sure you want to ${action} this repository?`)) return;

    setArchiving(true);
    try {
      const res = await api.put(`/repos/${owner}/${name}/archive`);
      setRepo(res.data.data.repo);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to change archive status");
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteRepository = async () => {
    if (deleteConfirmation !== `${owner}/${name}`) {
      setDeleteError(`Please type ${owner}/${name} exactly to confirm.`);
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await api.delete(`/repos/${owner}/${name}`);
      navigate("/dashboard");
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete repository");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-gray-400">
        <Loader2 size={36} className="animate-spin text-accent mb-4" />
        <p className="text-sm font-medium">Loading repository settings...</p>
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg">Access Denied or Error</h3>
            <p className="text-sm mt-1">{error || "Repository settings unavailable"}</p>
            <Link
              to={`/${owner}/${name}`}
              className="inline-block mt-4 text-sm font-medium text-white underline hover:text-accent"
            >
              Back to repository
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <RepoHeader owner={owner} name={name} activeTab="settings" />

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SettingsIcon size={16} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
          Repository Settings
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '2px' }}>
          Manage general options, collaborators, and repository state
        </p>
      </div>

      <div className="space-y-8">
        {/* 1. General Settings */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-white mb-1">General Settings</h2>
          <p className="text-xs text-gray-400 mb-6">Update basic information and repository defaults</p>

          <form onSubmit={handleUpdateGeneral} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Repository Name
              </label>
              <input
                type="text"
                disabled
                value={repo.name}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">Repository name cannot be changed directly</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="A short description of this repository"
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Visibility
                </label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${visibility === "public" ? "bg-accent/10 border-accent text-white" : "bg-dark-900 border-dark-700 text-gray-400 hover:text-white"}`}>
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === "public"}
                      onChange={() => setVisibility("public")}
                      className="hidden"
                    />
                    <Globe size={16} className={visibility === "public" ? "text-accent" : ""} />
                    <div>
                      <div className="text-sm font-medium">Public</div>
                      <div className="text-[11px] text-gray-400">Anyone can view</div>
                    </div>
                  </label>

                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${visibility === "private" ? "bg-accent/10 border-accent text-white" : "bg-dark-900 border-dark-700 text-gray-400 hover:text-white"}`}>
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === "private"}
                      onChange={() => setVisibility("private")}
                      className="hidden"
                    />
                    <Lock size={16} className={visibility === "private" ? "text-accent" : ""} />
                    <div>
                      <div className="text-sm font-medium">Private</div>
                      <div className="text-[11px] text-gray-400">Only members</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Default Branch
                </label>
                <div className="relative">
                  <select
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b._id || b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))
                    ) : (
                      <option value="main">main</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {generalError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{generalError}</span>
              </div>
            )}

            {generalSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-xs flex items-center gap-2">
                <Check size={14} />
                <span>{generalSuccess}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingGeneral}
                className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-dark-900 font-semibold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {savingGeneral ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>

        {/* 2. Collaborators & Access */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-accent" />
                <span>Collaborators</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Manage user access and roles for this repository</p>
            </div>
          </div>

          {/* Add collaborator form */}
          <form onSubmit={handleAddCollaborator} className="bg-dark-900/60 border border-dark-700 p-4 rounded-xl mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Add a collaborator</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter username"
                value={newCollabUsername}
                onChange={(e) => setNewCollabUsername(e.target.value)}
                className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
              <select
                value={newCollabRole}
                onChange={(e) => setNewCollabRole(e.target.value)}
                className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="viewer">Viewer (Read-only)</option>
                <option value="developer">Developer (Write)</option>
                <option value="maintainer">Maintainer (Admin)</option>
              </select>
              <button
                type="submit"
                disabled={addingCollab || !newCollabUsername.trim()}
                className="flex items-center justify-center gap-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
              >
                {addingCollab ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Add Member</span>
              </button>
            </div>

            {collabError && (
              <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{collabError}</span>
              </div>
            )}
            {collabSuccess && (
              <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg p-2.5 text-green-400 text-xs flex items-center gap-2">
                <Check size={14} />
                <span>{collabSuccess}</span>
              </div>
            )}
          </form>

          {/* Collaborator List */}
          <div className="divide-y divide-dark-700">
            {collaborators.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No additional collaborators configured.</p>
            ) : (
              collaborators.map((c) => (
                <div key={c._id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={c.user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.user?.username || "user"}`}
                      alt={c.user?.username}
                      className="w-8 h-8 rounded-full border border-dark-700"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{c.user?.username || "Unknown"}</div>
                      <div className="text-xs text-gray-500">{c.user?.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-0.5 rounded-full border border-dark-600 bg-dark-700 text-gray-300 capitalize">
                      {c.role}
                    </span>
                    <button
                      onClick={() => handleRemoveCollaborator(c.user?._id, c.user?.username)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Remove collaborator"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Danger Zone */}
        <div className="bg-dark-800 border border-red-500/30 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-1">
            <ShieldAlert size={18} />
            <span>Danger Zone</span>
          </h2>
          <p className="text-xs text-gray-400 mb-6">Destructive actions and permanent repository settings</p>

          <div className="space-y-4 divide-y divide-dark-700">
            {/* Archive */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 first:pt-0">
              <div>
                <div className="text-sm font-semibold text-white">
                  {repo.isArchived ? "Unarchive repository" : "Archive repository"}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {repo.isArchived
                    ? "Mark this repository as active again to allow new commits and issues."
                    : "Mark this repository as archived and read-only. Commits and issues will be locked."}
                </div>
              </div>
              <button
                onClick={handleToggleArchive}
                disabled={archiving}
                className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {archiving ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                <span>{repo.isArchived ? "Unarchive" : "Archive"}</span>
              </button>
            </div>

            {/* Delete */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
              <div>
                <div className="text-sm font-semibold text-red-400">Delete this repository</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Once deleted, all branches, commits, files, pull requests, and issues cannot be recovered.
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 border border-red-500/40 text-red-400 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                <Trash2 size={16} />
                <span>Delete repository</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 border border-red-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="text-red-500" size={20} />
              <span>Are you absolutely sure?</span>
            </h3>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              This action <span className="font-semibold text-red-400">cannot</span> be undone. This will permanently delete the{" "}
              <span className="font-mono font-semibold text-white">{owner}/{name}</span> repository, commits, files, issues, and pull requests.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">
                Please type <span className="font-mono text-white select-all font-semibold">{owner}/{name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={`${owner}/${name}`}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            {deleteError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation("");
                  setDeleteError("");
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRepository}
                disabled={deleting || deleteConfirmation !== `${owner}/${name}`}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                <span>I understand, delete this repository</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoSettings;
