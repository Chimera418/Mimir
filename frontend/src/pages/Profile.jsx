import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FolderGit2, Lock, Globe, Loader2, AlertCircle, User, GitCommit } from "lucide-react";
import api from "../services/api";
import useAuthStore from "../store/authStore";

const Profile = () => {
  const { username } = useParams();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/users/${username}`);
        const data = res.data.data;
        setProfile(data.user);
        setRepos(data.repos || []);
        
        // Fetch contributions if we have the user id
        if (data.user?._id) {
          try {
            const cRes = await api.get(`/analytics/users/${data.user._id}/contributions`);
            const cData = cRes.data.data;
            setContributions(cData.contributions || []);
          } catch (_) {}
        }
      } catch (err) {
        setError(err.response?.data?.message || "User not found");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] mt-16"><Loader2 className="animate-spin text-accent" size={40} /></div>;
  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-16 mt-16">
      <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-6 rounded-xl flex items-center gap-3">
        <AlertCircle size={24} />{error}
      </div>
    </div>
  );

  const totalContributions = contributions.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...contributions.map(d => d.count), 1);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="text-center lg:text-left">
            <img src={profile?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`}
              alt={username} className="w-24 h-24 rounded-full border-2 border-dark-700 mx-auto lg:mx-0 mb-4" />
            <h1 className="text-xl font-bold text-white">{profile?.username}</h1>
            {profile?.bio && <p className="text-gray-400 text-sm mt-2 leading-relaxed">{profile.bio}</p>}
            <div className="mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                <User size={12} />
                Joined {new Date(profile?.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
            </div>
            {currentUser?.username === username && (
              <Link to="/settings" className="block mt-4 text-center border border-dark-600 hover:border-gray-500 text-gray-300 hover:text-white px-4 py-1.5 rounded-lg text-sm transition-colors">
                Edit profile
              </Link>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-3 space-y-6">
          {/* Contributions */}
          {contributions.length > 0 && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
              <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                <GitCommit size={16} className="text-accent" />
                {totalContributions} contributions in the last year
              </h3>
              <div className="flex flex-wrap gap-1">
                {contributions.slice(-90).map((d, i) => (
                  <div key={i} title={`${d.date}: ${d.count} commit${d.count !== 1 ? "s" : ""}`}
                    style={{ opacity: d.count === 0 ? 0.15 : Math.max(0.3, d.count / maxCount) }}
                    className={`w-3 h-3 rounded-sm ${d.count > 0 ? "bg-accent" : "bg-dark-700"}`} />
                ))}
              </div>
            </div>
          )}

          {/* Repos */}
          <div>
            <h2 className="font-bold text-white text-lg mb-4">{repos.length} repositor{repos.length !== 1 ? "ies" : "y"}</h2>
            {repos.length === 0 ? (
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-8 text-center text-gray-500">
                <FolderGit2 size={32} className="mx-auto mb-3 opacity-40" />
                <p>No public repositories</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {repos.map(repo => (
                  <Link key={repo._id} to={`/${repo.owner?.username || username}/${repo.name}`}
                    className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-accent transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-accent font-semibold group-hover:underline">
                        <FolderGit2 size={16} />
                        <span className="truncate">{repo.name}</span>
                      </div>
                      {repo.visibility === "private" ? <Lock size={13} className="text-gray-500" /> : <Globe size={13} className="text-gray-500" />}
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2">{repo.description || "No description"}</p>
                    <div className="text-xs text-gray-500 mt-3">
                      Updated {new Date(repo.updatedAt).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
