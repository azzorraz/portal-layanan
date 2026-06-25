import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Ticket, FileBarChart2, Settings2, LogOut, PlusCircle, KeyRound, ChevronDown,
} from "lucide-react";
import NotificationsBell from "@/components/NotificationsBell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const linkBase =
  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors";

function SideLink({ to, icon: Icon, label, testId, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={testId}
      className={({ isActive }) =>
        `${linkBase} ${isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isKoor = user?.role === "koordinator";
  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-zinc-200 bg-white">
        <div className="h-16 flex items-center px-5 border-b border-zinc-200">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="sidebar-brand">
            <div className="h-7 w-7 rounded-md bg-zinc-900 text-white inline-flex items-center justify-center text-[11px] font-bold tracking-tighter">
              DP
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold text-zinc-900">Dapodik</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Ticketing</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400 font-semibold">Menu</div>
          <SideLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" testId="nav-dashboard" />
          <SideLink to="/tickets" icon={Ticket} label="Tickets" testId="nav-tickets" />
          {user?.role === "operator" && (
            <SideLink to="/tickets/new" icon={PlusCircle} label="Buat Pengajuan" testId="nav-new-ticket" />
          )}
          {isKoor && <SideLink to="/reports" icon={FileBarChart2} label="Laporan" testId="nav-reports" />}
          {isKoor && (
            <>
              <div className="pt-4 px-2 pb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400 font-semibold">
                Admin
              </div>
              <SideLink to="/master" icon={Settings2} label="Master Data" testId="nav-master" />
            </>
          )}
        </nav>

        <div className="border-t border-zinc-200 p-3 text-xs text-zinc-500">
          <div className="px-2 py-1 leading-tight">
            Logged in as
            <div className="text-zinc-900 font-medium truncate">{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-zinc-200 flex items-center justify-between px-4 sm:px-6">
          <div className="md:hidden">
            <Link to="/dashboard" className="font-display font-semibold">Dapodik</Link>
          </div>
          <div className="hidden md:block">
            <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              {isKoor ? "Koordinator Workspace" : "Operator Sekolah"}
            </div>
            <div className="text-sm text-zinc-900 font-medium">
              {user?.name}{user?.sekolah?.nama ? ` • ${user.sekolah.nama}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="user-menu-trigger"
                  className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50"
                >
                  <span className="h-7 w-7 rounded-md bg-zinc-900 text-white text-[11px] font-semibold inline-flex items-center justify-center">
                    {initials}
                  </span>
                  <span className="hidden sm:block text-sm text-zinc-700">{user?.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">
                  <div className="font-medium">{user?.name}</div>
                  <div className="text-zinc-500 truncate">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/change-password")} data-testid="menu-change-password">
                  <KeyRound className="h-4 w-4 mr-2" /> Ganti Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="menu-logout"
                  onClick={async () => { await logout(); navigate("/login"); }}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full mx-auto reveal">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
