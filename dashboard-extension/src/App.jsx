import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileCheck2,
  Leaf,
  Map,
  Menu,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const carbonData = [
  { month: "Jan", value: 38 },
  { month: "Feb", value: 41 },
  { month: "Mar", value: 39 },
  { month: "Apr", value: 46 },
  { month: "May", value: 49 },
  { month: "Jun", value: 52 },
  { month: "Jul", value: 56 },
  { month: "Aug", value: 61 },
];

const sites = [
  {
    name: "Pichavaram",
    region: "Tamil Nadu",
    district: "Cuddalore",
    area: "1,428 ha",
    progress: 91,
    status: "On track",
    carbon: "68.2 tC/ha",
    survey: "24 Aug 2026",
    type: "Mangrove",
  },
  {
    name: "Godavari Delta",
    region: "Andhra Pradesh",
    district: "Konaseema",
    area: "1,176 ha",
    progress: 78,
    status: "On track",
    carbon: "63.7 tC/ha",
    survey: "22 Aug 2026",
    type: "Mangrove",
  },
  {
    name: "Sundarbans",
    region: "West Bengal",
    district: "South 24 Parganas",
    area: "982 ha",
    progress: 64,
    status: "Attention",
    carbon: "57.9 tC/ha",
    survey: "18 Aug 2026",
    type: "Mangrove",
  },
  {
    name: "Bhitarkanika",
    region: "Odisha",
    district: "Kendrapara",
    area: "694 ha",
    progress: 52,
    status: "Review",
    carbon: "55.4 tC/ha",
    survey: "14 Aug 2026",
    type: "Mangrove",
  },
  {
    name: "Muthupet",
    region: "Tamil Nadu",
    district: "Thiruvarur",
    area: "486 ha",
    progress: 86,
    status: "On track",
    carbon: "61.8 tC/ha",
    survey: "20 Aug 2026",
    type: "Mangrove",
  },
];

const activity = [
  {
    title: "Field survey submitted",
    site: "Pichavaram Mangrove Reserve",
    time: "18 min ago",
    icon: ClipboardCheck,
  },
  {
    title: "Carbon sample validated",
    site: "Godavari Delta",
    time: "43 min ago",
    icon: ShieldCheck,
  },
  {
    title: "Satellite dataset synced",
    site: "Sundarbans",
    time: "1 hr ago",
    icon: Database,
  },
];

function StatCard({ label, value, change, positive, icon: Icon }) {
  return (
    <div className="group border border-[#dddcd5] bg-[#fafaf7] p-5 transition hover:border-[#b9b9ae]">
      <div className="mb-7 flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#77776f]">
          {label}
        </span>

        <Icon
          size={17}
          strokeWidth={1.5}
          className="text-[#77776f] transition group-hover:text-[#183c2b]"
        />
      </div>

      <div className="flex items-end justify-between gap-4">
        <span className="text-[30px] font-semibold tracking-[-0.04em] text-[#18231e]">
          {value}
        </span>

        <span
          className={`mb-1 flex items-center gap-1 text-xs ${
            positive ? "text-[#397052]" : "text-[#a06445]"
          }`}
        >
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change}
        </span>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState("overview");
  return (
    <div className="min-h-screen bg-[#f3f3ee] text-[#18231e]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-[244px] shrink-0 border-r border-[#d9d9d1] bg-[#eeeee8] lg:flex lg:flex-col">
          <div className="border-b border-[#d9d9d1] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center bg-[#183c2b] text-[#f2f2ed]">
                <Waves size={19} strokeWidth={1.7} />
              </div>

              <div>
                <div className="text-[13px] font-semibold tracking-wide">
                  NCCR
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#77776f]">
                  Blue Carbon MRV
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 py-6">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a8a82]">
              Workspace
            </p>

           <nav className="space-y-1">
  <NavItem
    icon={BarChart3}
    label="Overview"
    active={page === "overview"}
    onClick={() => setPage("overview")}
  />

  <NavItem
    icon={Map}
    label="Project Sites"
    active={page === "sites"}
    onClick={() => setPage("sites")}
  />

  <NavItem
    icon={Activity}
    label="Monitoring"
    active={page === "monitoring"}
    onClick={() => setPage("monitoring")}
  />

  <NavItem
    icon={Database}
    label="Data Registry"    active={page === "data"}
    onClick={() => setPage("data")}
  />

  <NavItem
    icon={ClipboardCheck}
    label="Validation"
    active={page === "validation"}
    onClick={() => setPage("validation")}
  />

  <NavItem
    icon={FileCheck2}
    label="Reports"
    active={page === "reports"}
    onClick={() => setPage("reports")}
  />
</nav>

            <p className="px-3 pb-3 pt-8 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a8a82]">
              System
            </p>

            <nav className="space-y-1">
              <NavItem icon={Settings} label="Settings" />
              <NavItem icon={CircleHelp} label="Support" />
            </nav>
          </div>

          <div className="mt-auto border-t border-[#d9d9d1] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7ddd5] text-xs font-semibold text-[#36533f]">
                AR
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-medium">Research Admin</p>
                <p className="truncate text-[10px] text-[#7d7d75]">
                  NCCR Operations
                </p>
              </div>

              <ChevronDown size={14} className="ml-auto text-[#77776f]" />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          {/* Header */}
          <header className="flex h-[72px] items-center justify-between border-b border-[#d9d9d1] bg-[#f3f3ee]/95 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button className="lg:hidden">
                <Menu size={21} />
              </button>

              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#83837b]">
                  National Centre for Coastal Research
                </p>
                <h1 className="mt-0.5 text-lg font-semibold tracking-[-0.02em]">
                  Blue Carbon Monitoring
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 border border-[#d5d5cd] bg-[#eeeeea] px-3 py-2 text-xs text-[#5e5e58] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#47785a]" />
                All systems operational
              </div>

              <button className="relative flex h-9 w-9 items-center justify-center border border-[#d5d5cd] bg-[#eeeeea] text-[#5f5f59] hover:text-[#183c2b]">
                <Bell size={16} strokeWidth={1.7} />
                <span className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#a06445]" />
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
          {page === "sites" ? <ProjectSitesPage /> : <OverviewPage />}
            <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] text-[#77776f]">
                  <span>Operations</span>
                  <span>/</span>
                  <span className="text-[#3d4d44]">Overview</span>
                </div>

                <h2 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[34px]">
                  MRV overview
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#71716a]">
                  A consolidated view of field monitoring, carbon stock
                  measurements, and verification activity across active coastal
                  projects.
                </p>
              </div>

              <button className="flex h-10 items-center justify-center gap-2 border border-[#cfcfc7] bg-[#fafaf7] px-4 text-xs font-medium text-[#34443b] transition hover:border-[#183c2b]">
                <SlidersHorizontal size={14} />
                Configure view
              </button>
            </div>

            {/* Stats */}
            <div className="grid gap-px border border-[#d9d9d1] bg-[#d9d9d1] sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Active project sites"
                value="18"
                change="2 this quarter"
                positive
                icon={Map}
              />

              <StatCard
                label="Monitored area"
                value="4,280 ha"
                change="8.4%"
                positive
                icon={Leaf}
              />

              <StatCard
                label="Carbon stock"
                value="61.4 tC/ha"
                change="6.8%"
                positive
                icon={Waves}
              />

              <StatCard
                label="Validation queue"
                value="07"
                change="3 pending"
                positive={false}
                icon={ShieldCheck}
              />
            </div>

            {/* Analytics */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
              <section className="border border-[#d9d9d1] bg-[#fafaf7]">
                <div className="flex items-start justify-between border-b border-[#e0e0d9] px-5 py-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">
                        Carbon stock trend
                      </h3>
                      <span className="border border-[#cbd6cc] bg-[#e9eee9] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#42634f]">
                        Verified
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#7c7c74]">
                      Average measured carbon stock · tC/ha
                    </p>
                  </div>

                  <button className="text-[#7c7c74] hover:text-[#183c2b]">
                    <MoreHorizontal size={18} />
                  </button>
                </div>

                <div className="h-[310px] px-3 pb-4 pt-6 sm:px-5">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={carbonData}>
                      <defs>
                        <linearGradient
                          id="carbonFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#4d755c"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#4d755c"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        vertical={false}
                        stroke="#e3e3dc"
                        strokeDasharray="2 4"
                      />

                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 11,
                          fill: "#85857d",
                        }}
                        dy={8}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#85857d",
                        }}
                        width={32}
                      />

                      <Tooltip
                        contentStyle={{
                          border: "1px solid #d9d9d1",
                          background: "#fafaf7",
                          fontSize: 12,
                          boxShadow: "none",
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#315d45"
                        strokeWidth={2}
                        fill="url(#carbonFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Validation */}
              <section className="border border-[#d9d9d1] bg-[#fafaf7]">
                <div className="border-b border-[#e0e0d9] px-5 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Validation queue
                      </h3>
                      <p className="mt-1 text-xs text-[#7c7c74]">
                        Current verification workload
                      </p>
                    </div>

                    <FileCheck2
                      size={18}
                      strokeWidth={1.5}
                      className="text-[#77776f]"
                    />
                  </div>
                </div>

                <div className="divide-y divide-[#e5e5de]">
                  <QueueRow
                    number="07"
                    label="Awaiting review"
                    detail="Field datasets"
                  />
                  <QueueRow
                    number="03"
                    label="Needs attention"
                    detail="Measurement anomalies"
                    warning
                  />
                  <QueueRow
                    number="12"
                    label="Verified"
                    detail="This reporting period"
                  />
                </div>

                <div className="p-5">
                  <button className="flex w-full items-center justify-between border border-[#d2d2ca] px-4 py-3 text-xs font-medium text-[#405147] transition hover:border-[#183c2b]">
                    Open validation workspace
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </section>
            </div>

            {/* Bottom grid */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
              {/* Sites */}
              <section className="border border-[#d9d9d1] bg-[#fafaf7]">
                <div className="flex items-center justify-between border-b border-[#e0e0d9] px-5 py-5">
                  <div>
                    <h3 className="text-sm font-semibold">Project sites</h3>
                    <p className="mt-1 text-xs text-[#7c7c74]">
                      Monitoring progress across priority sites
                    </p>
                  </div>

                  <button className="text-xs font-medium text-[#46604f] hover:text-[#183c2b]">
                    View all
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead>
                      <tr className="border-b border-[#e5e5de] text-[10px] uppercase tracking-[0.14em] text-[#85857d]">
                        <th className="px-5 py-3 font-medium">Site</th>
                        <th className="px-4 py-3 font-medium">Area</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#e8e8e1]">
                      {sites.map((site) => (
                        <tr
                          key={site.name}
                          className="group transition hover:bg-[#f3f3ed]"
                        >
                          <td className="px-5 py-4">
                            <div className="text-xs font-semibold">
                              {site.name}
                            </div>
                            <div className="mt-1 text-[10px] text-[#85857d]">
                              {site.region}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-xs text-[#555750]">
                            {site.area}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 w-[90px] bg-[#e1e2db]">
                                <div
                                  className="h-full bg-[#476d55]"
                                  style={{ width: `${site.progress}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-[#65665f]">
                                {site.progress}%
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <Status status={site.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Activity */}
              <section className="border border-[#d9d9d1] bg-[#fafaf7]">
                <div className="flex items-center justify-between border-b border-[#e0e0d9] px-5 py-5">
                  <div>
                    <h3 className="text-sm font-semibold">Recent activity</h3>
                    <p className="mt-1 text-xs text-[#7c7c74]">
                      Latest system events
                    </p>
                  </div>

                  <Activity
                    size={17}
                    strokeWidth={1.5}
                    className="text-[#77776f]"
                  />
                </div>

                <div className="divide-y divide-[#e5e5de]">
                  {activity.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="flex gap-3 px-5 py-4 transition hover:bg-[#f3f3ed]"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#d8dcd6] bg-[#eef1ec] text-[#45664f]">
                          <Icon size={15} strokeWidth={1.6} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-medium">{item.title}</p>
                          <p className="mt-1 truncate text-[10px] text-[#777870]">
                            {item.site}
                          </p>
                          <p className="mt-1 text-[10px] text-[#9a9a92]">
                            {item.time}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-[#d9d9d1] pt-4 text-[10px] text-[#898981] sm:flex-row">
              <span>NCCR Blue Carbon MRV Platform</span>
              <span>Data refreshed 11:32 IST · v0.1.0</span>
            </footer>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick  }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs transition ${
        active
          ? "bg-[#dfe5df] font-semibold text-[#183c2b]"
          : "text-[#696a63] hover:bg-[#e5e5df] hover:text-[#25362d]"
      }`}
    >
      <Icon size={16} strokeWidth={active ? 1.9 : 1.5} />
      <span>{label}</span>
    </button>
  );
}

function QueueRow({ number, label, detail, warning }) {
  return (
    <div className="flex items-center gap-4 px-5 py-5">
      <div className="w-12 text-[26px] font-semibold tracking-[-0.04em] text-[#25382d]">
        {number}
      </div>

      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-1 text-[10px] text-[#85857d]">{detail}</p>
      </div>

      <span
        className={`ml-auto h-2 w-2 rounded-full ${
          warning ? "bg-[#a06445]" : "bg-[#54745e]"
        }`}
      />
    </div>
  );
}

function Status({ status }) {
  const styles = {
    "On track": "bg-[#e8eee8] text-[#45654f] border-[#ccd8cd]",
    Attention: "bg-[#f2ebe4] text-[#8b5d43] border-[#dfcdbd]",
    Review: "bg-[#ecebe6] text-[#6d6b60] border-[#d5d4cb]",
  };

  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${
        styles[status]
      }`}
    >
      {status}
    </span>
  );
}

export default App;
function ProjectSitesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedSite, setSelectedSite] = useState(null);

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      const matchesSearch =
        site.name.toLowerCase().includes(search.toLowerCase()) ||
        site.region.toLowerCase().includes(search.toLowerCase()) ||
        site.district.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || site.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#77776f]">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#3d4d44]">Project Sites</span>
          </div>

          <h2 className="text-[30px] font-semibold tracking-[-0.04em]">
            Project sites
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71716a]">
            Monitor the status, coverage, and verification progress of active
            blue carbon sites across India's coastal ecosystems.
          </p>
        </div>

        <button className="flex h-10 items-center justify-center gap-2 border border-[#cfcfc7] bg-[#fafaf7] px-4 text-xs font-medium text-[#34443b] hover:border-[#183c2b]">
          <Map size={14} />
          Add project site
        </button>
      </div>

      {/* Summary strip */}
      <div className="mb-6 grid gap-px border border-[#d9d9d1] bg-[#d9d9d1] sm:grid-cols-3">
        <div className="bg-[#fafaf7] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#85857d]">
            Active sites
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            18
          </p>
        </div>

        <div className="bg-[#fafaf7] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#85857d]">
            Total monitored area
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            4,280 ha
          </p>
        </div>

        <div className="bg-[#fafaf7] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#85857d]">
            Sites requiring attention
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#8b5d43]">
            04
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 border border-[#d9d9d1] bg-[#fafaf7] p-3 md:flex-row">
        <div className="relative flex-1">
          <Map
            size={15}
            strokeWidth={1.6}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85857d]"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search site, region or district..."
            className="h-10 w-full border border-[#d8d8d0] bg-[#f3f3ee] pl-9 pr-3 text-xs outline-none placeholder:text-[#999990] focus:border-[#78907e]"
          />
        </div>

        <div className="flex gap-2">
          {["All", "On track", "Attention", "Review"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`h-10 border px-3 text-[11px] transition ${
                statusFilter === status
                  ? "border-[#183c2b] bg-[#183c2b] text-white"
                  : "border-[#d8d8d0] bg-[#f3f3ee] text-[#686961] hover:border-[#9b9b92]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Site table */}
      <section className="border border-[#d9d9d1] bg-[#fafaf7]">
        <div className="flex items-center justify-between border-b border-[#e0e0d9] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">
              {filteredSites.length} sites displayed
            </h3>
            <p className="mt-1 text-[10px] text-[#85857d]">
              Showing current monitoring information
            </p>
          </div>

          <button className="flex items-center gap-2 text-xs text-[#62645d]">
            <SlidersHorizontal size={14} />
            Columns
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-[#e4e4dd] text-[10px] uppercase tracking-[0.14em] text-[#85857d]">
                <th className="px-5 py-3 font-medium">Project site</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Carbon stock</th>
                <th className="px-4 py-3 font-medium">Monitoring</th>
                <th className="px-4 py-3 font-medium">Last survey</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#e7e7e0]">
              {filteredSites.map((site) => (
                <tr
                  key={site.name}
                  className="group cursor-pointer hover:bg-[#f1f2ec]"
                  onClick={() => setSelectedSite(site)}
                >
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center bg-[#e6ebe5] text-[#45664f]">
                        <Waves size={16} strokeWidth={1.5} />
                      </div>

                      <div>
                        <p className="text-xs font-semibold">{site.name}</p>
                        <p className="mt-1 text-[10px] text-[#85857d]">
                          {site.district}, {site.region}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-5 text-xs text-[#555750]">
                    {site.area}
                  </td>

                  <td className="px-4 py-5">
                    <span className="text-xs font-medium">
                      {site.carbon}
                    </span>
                  </td>

                  <td className="px-4 py-5">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-[90px] bg-[#e0e1da]">
                        <div
                          className="h-full bg-[#476d55]"
                          style={{ width: `${site.progress}%` }}
                        />
                      </div>

                      <span className="text-[10px] text-[#686961]">
                        {site.progress}%
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-5 text-xs text-[#686961]">
                    {site.survey}
                  </td>

                  <td className="px-4 py-5">
                    <Status status={site.status} />
                  </td>

                  <td className="px-4 py-5">
                    <ArrowUpRight
                      size={15}
                      className="text-[#999990] transition group-hover:text-[#183c2b]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSites.length === 0 && (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium">No sites found</p>
            <p className="mt-1 text-xs text-[#85857d]">
              Try changing your search or status filter.
            </p>
          </div>
        )}
      </section>

      {/* Detail drawer */}
      {selectedSite && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#18231e]/20">
          <div className="h-full w-full max-w-[460px] overflow-y-auto border-l border-[#d4d4cc] bg-[#f3f3ee] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d9d9d1] bg-[#fafaf7] px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#85857d]">
                  Project site
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {selectedSite.name}
                </h3>
              </div>

              <button
                onClick={() => setSelectedSite(null)}
                className="flex h-8 w-8 items-center justify-center border border-[#d5d5cd] text-lg text-[#66675f] hover:border-[#183c2b]"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <Status status={selectedSite.status} />

              <div className="mt-7 grid grid-cols-2 gap-px border border-[#d9d9d1] bg-[#d9d9d1]">
                <DetailStat label="Area" value={selectedSite.area} />
                <DetailStat label="Carbon stock" value={selectedSite.carbon} />
                <DetailStat
                  label="Monitoring"
                  value={`${selectedSite.progress}%`}
                />
                <DetailStat label="Last survey" value={selectedSite.survey} />
              </div>

              <div className="mt-7">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#85857d]">
                  Monitoring progress
                </p>

                <div className="mt-3 h-2 bg-[#dedfd8]">
                  <div
                    className="h-full bg-[#476d55]"
                    style={{ width: `${selectedSite.progress}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-[10px] text-[#85857d]">
                  <span>Monitoring completion</span>
                  <span>{selectedSite.progress}%</span>
                </div>
              </div>

              <div className="mt-8 border-t border-[#d9d9d1] pt-6">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#85857d]">
                  Site information
                </p>

                <dl className="mt-4 space-y-4">
                  <DetailRow label="Ecosystem" value={selectedSite.type} />
                  <DetailRow label="Region" value={selectedSite.region} />
                  <DetailRow label="District" value={selectedSite.district} />
                  <DetailRow label="MRV status" value={selectedSite.status} />
                </dl>
              </div>

              <button className="mt-8 flex h-11 w-full items-center justify-center gap-2 bg-[#183c2b] text-xs font-medium text-white hover:bg-[#244d39]">
                Open site workspace
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="bg-[#fafaf7] p-4">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[#85857d]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-[#e1e1da] pb-3">
      <dt className="text-xs text-[#85857d]">{label}</dt>
      <dd className="text-xs font-medium text-[#37473e]">{value}</dd>
    </div>
  );
}