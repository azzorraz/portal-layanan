import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bell } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { relativeTime } from "@/lib/format";

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try { const { data } = await api.get("/notifications"); setItems(data.items || []); setUnread(data.unread || 0); } catch { /* noop */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, []);

  const markRead = async () => {
    try { await api.post("/notifications/mark-read"); } catch { /* noop */ }
    load();
  };

  return (
    <DropdownMenu onOpenChange={(o) => { if (o && unread > 0) markRead(); }}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="notifications-bell"
          className="relative h-9 w-9 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 inline-flex items-center justify-center transition-colors"
          aria-label="Notifikasi"
        >
          <Bell className="h-4 w-4 text-zinc-700" />
          {unread > 0 && (
            <span
              data-testid="notifications-unread-badge"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold inline-flex items-center justify-center"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-zinc-500">Notifikasi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <div className="px-3 py-6 text-sm text-zinc-500 text-center">Belum ada notifikasi</div>
        )}
        {items.slice(0, 8).map((n) => (
          <DropdownMenuItem key={n.id} asChild>
            <Link
              to={n.ticket_id ? `/tickets/${n.ticket_id}` : "#"}
              data-testid={`notif-item-${n.id}`}
              className="flex flex-col items-start gap-0.5 cursor-pointer"
            >
              <div className="text-sm font-medium text-zinc-900">{n.title}</div>
              <div className="text-xs text-zinc-500">{n.body}</div>
              <div className="text-[10px] text-zinc-400">{relativeTime(n.created_at)}</div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
