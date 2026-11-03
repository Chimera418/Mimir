import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users/me/notifications?limit=50");
      const data = res.data.data;
      const notifs = data.notifications || (Array.isArray(data) ? data : []);
      setNotifications(notifs);
      setUnreadCount(data.unreadCount || notifs.filter(n => !n.read).length);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      await api.put("/users/me/notifications/read");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError("Failed to mark notifications as read");
    } finally {
      setMarking(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const typeColors = {
    collaborator_added: "text-blue-400",
    pr_opened: "text-green-400",
    pr_merged: "text-purple-400",
    pr_commented: "text-yellow-400",
    pr_closed: "text-gray-400",
    issue_assigned: "text-orange-400",
    issue_commented: "text-yellow-400",
    mention: "text-accent",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 mt-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={24} />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-accent text-dark-900 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Your activity and mentions</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={marking}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-dark-800 border border-dark-700 px-3 py-1.5 rounded-lg transition-colors">
            {marking ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Mark all read
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg mb-6 flex items-center gap-2"><AlertCircle size={16}/>{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" size={36} /></div>
      ) : notifications.length === 0 ? (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-12 text-center text-gray-500">
          <Bell size={40} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg">You are all caught up!</p>
          <p className="text-sm mt-1">No notifications to display</p>
        </div>
      ) : (
        <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
          <div className="divide-y divide-dark-700">
            {notifications.map(n => (
              <div key={n._id} className={`flex items-start gap-4 px-5 py-4 transition-colors ${!n.read ? "bg-accent/5 border-l-2 border-accent" : "hover:bg-dark-700/30"}`}>
                <img src={n.actor?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${n.actor?.username || "system"}`}
                  className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs capitalize ${typeColors[n.type] || "text-gray-400"}`}>{n.type?.replace(/_/g, " ")}</span>
                    <span className="text-gray-500 text-xs">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
