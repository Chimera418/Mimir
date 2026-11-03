import { useEffect, useState } from "react";
import { Activity, GitCommit, Users, BarChart2, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

const GlobalAnalytics = () => {
  const [data, setData] = useState({ commitsPerRepo: [], commitsPerUser: [], topContributors: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [cpr, cpu, tc] = await Promise.all([
          api.get("/analytics/global/commits-per-repo"),
          api.get("/analytics/global/commits-per-user"),
          api.get("/analytics/global/top-contributors"),
        ]);
        const cprData = cpr.data.data;
        const cpuData = cpu.data.data;
        const tcData = tc.data.data;
        setData({
          commitsPerRepo: Array.isArray(cprData) ? cprData : cprData?.repos || [],
          commitsPerUser: Array.isArray(cpuData) ? cpuData : cpuData?.users || [],
          topContributors: Array.isArray(tcData) ? tcData : tcData?.contributors || [],
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load global analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] mt-16"><Loader2 className="animate-spin text-accent" size={40} /></div>;

  const maxCPR = Math.max(...data.commitsPerRepo.map(r => r.commits), 1);
  const maxCPU = Math.max(...data.commitsPerUser.map(u => u.commits), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 mt-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart2 size={30} className="text-accent" />
          Global Analytics
        </h1>
        <p className="text-gray-400 mt-1">Platform-wide statistics powered by MongoDB aggregation pipelines</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6 flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <StatBadge label="Total Repos Tracked" value={data.commitsPerRepo.length} icon={<GitCommit />} color="text-blue-400" />
        <StatBadge label="Active Contributors" value={data.topContributors.length} icon={<Users />} color="text-green-400" />
        <StatBadge label="Total Commits" value={data.commitsPerUser.reduce((s, u) => s + u.commits, 0)} icon={<Activity />} color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commits Per Repo */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><GitCommit size={16} className="text-accent" /> Commits by Repository</h3>
          {data.commitsPerRepo.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {data.commitsPerRepo.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-36 text-gray-400 text-xs truncate flex-shrink-0">{r.repo || r._id?.name || r.name}</div>
                  <div className="flex-1 h-3 bg-dark-900 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${(r.commits / maxCPR) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-gray-300 text-xs">{r.commits}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Contributors */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Users size={16} className="text-green-400" /> Top Contributors</h3>
          {data.topContributors.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {data.topContributors.slice(0, 10).map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-gray-600 text-xs font-mono w-5 text-right">{i + 1}</span>
                  <img src={c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.username}`} className="w-6 h-6 rounded-full" alt="" />
                  <span className="text-white text-sm font-medium flex-1">{c.username}</span>
                  <span className="text-gray-400 text-xs">{c.commits} commits</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commits Per User */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 lg:col-span-2">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Activity size={16} className="text-purple-400" /> Commits by User</h3>
          {data.commitsPerUser.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.commitsPerUser.slice(0, 20).map((u, i) => (
                <div key={i} className="flex items-center gap-3">
                  <img src={u.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.username}`} className="w-5 h-5 rounded-full flex-shrink-0" alt="" />
                  <div className="w-24 text-gray-300 text-xs truncate flex-shrink-0">{u.username}</div>
                  <div className="flex-1 h-2.5 bg-dark-900 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(u.commits / maxCPU) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-gray-400 text-xs">{u.commits}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatBadge = ({ label, value, icon, color }) => (
  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex items-center gap-4">
    <div className={`p-3 rounded-lg bg-dark-900 border border-dark-700 ${color}`}>{icon}</div>
    <div>
      <p className="text-gray-400 text-sm font-medium">{label}</p>
      <h4 className="text-2xl font-bold text-white">{value}</h4>
    </div>
  </div>
);

export default GlobalAnalytics;
