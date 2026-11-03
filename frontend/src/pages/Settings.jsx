import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, AlertCircle, Check, Loader2 } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";

const Settings = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({ bio: user?.bio || "", avatar: user?.avatar || "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileStatus, setProfileStatus] = useState({ loading: false, error: "", success: "" });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: "", success: "" });

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileStatus({ loading: true, error: "", success: "" });
    try {
      await api.put("/users/me", profileForm);
      setProfileStatus({ loading: false, error: "", success: "Profile updated successfully!" });
    } catch (err) {
      setProfileStatus({ loading: false, error: err.response?.data?.message || "Failed to update profile", success: "" });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordStatus({ loading: true, error: "", success: "" });
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ loading: false, error: "New passwords do not match", success: "" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordStatus({ loading: false, error: "New password must be at least 6 characters", success: "" });
      return;
    }
    try {
      await api.put("/users/me/password", { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordStatus({ loading: false, error: "", success: "Password changed successfully!" });
    } catch (err) {
      setPasswordStatus({ loading: false, error: err.response?.data?.message || "Failed to change password", success: "" });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 mt-16">
      <h1 className="text-2xl font-bold text-white mb-8">Account Settings</h1>

      {/* Profile */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-white text-lg flex items-center gap-2 mb-5">
          <User size={18} className="text-accent" /> Profile
        </h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Username</label>
            <input type="text" value={user?.username || ""} disabled
              className="w-full bg-dark-900/50 border border-dark-600 rounded-lg px-4 py-2 text-gray-500 cursor-not-allowed" />
            <p className="text-xs text-gray-600 mt-1">Username cannot be changed</p>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Email</label>
            <input type="email" value={user?.email || ""} disabled
              className="w-full bg-dark-900/50 border border-dark-600 rounded-lg px-4 py-2 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Avatar URL</label>
            <input type="url" value={profileForm.avatar} onChange={e => setProfileForm({...profileForm, avatar: e.target.value})}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Bio</label>
            <textarea value={profileForm.bio} onChange={e => setProfileForm({...profileForm, bio: e.target.value})} rows={3}
              placeholder="Tell us a little about yourself"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-accent transition-colors resize-none" />
          </div>
          {profileStatus.error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2"><AlertCircle size={14}/>{profileStatus.error}</div>}
          {profileStatus.success && <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2"><Check size={14}/>{profileStatus.success}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={profileStatus.loading}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-60 text-dark-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
              {profileStatus.loading && <Loader2 size={14} className="animate-spin" />} Save changes
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-white text-lg flex items-center gap-2 mb-5">
          <Lock size={18} className="text-yellow-400" /> Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {["currentPassword", "newPassword", "confirmPassword"].map(field => (
            <div key={field}>
              <label className="block text-gray-400 text-sm mb-1.5">
                {field === "currentPassword" ? "Current password" : field === "newPassword" ? "New password" : "Confirm new password"}
              </label>
              <input type="password" value={passwordForm[field]} onChange={e => setPasswordForm({...passwordForm, [field]: e.target.value})}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-accent transition-colors" />
            </div>
          ))}
          {passwordStatus.error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2"><AlertCircle size={14}/>{passwordStatus.error}</div>}
          {passwordStatus.success && <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2"><Check size={14}/>{passwordStatus.success}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={passwordStatus.loading}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-dark-900 font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
              {passwordStatus.loading && <Loader2 size={14} className="animate-spin" />} Change password
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-dark-800 border border-red-500/30 rounded-xl p-6">
        <h2 className="font-bold text-red-400 text-lg mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Sign out</p>
            <p className="text-gray-400 text-sm">Log out of your account on this device</p>
          </div>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
