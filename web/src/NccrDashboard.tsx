import { useMemo, useState, type ReactNode } from "react";
import "./dashboard.css";

type Status = "Needs review" | "Provisional" | "Disputed" | "Released" | "Rejected";
type View = "Overview" | "Review queue" | "Disputes" | "Rules" | "Audit trail";

type Submission = {
  id: string;
  ngo: string;
  location: string;
  date: string;
  score: number;
  status: Status;
  flags: string[];
  before: number;
  after: number;
  wallet: string;
  photo: string;
};

const submissions: Submission[] = [
  { id: "BC-2026-0148", ngo: "Sundarbans Collective", location: "Gosaba, West Bengal", date: "26 Aug 2026", score: 34, status: "Needs review", flags: ["Low vegetation increase", "EXIF timestamp mismatch"], before: 0.42, after: 0.44, wallet: "0x7a3e…f9e2", photo: "Field photo · 2.8 MB" },
  { id: "BC-2026-0146", ngo: "Coastal Roots", location: "Puri, Odisha", date: "26 Aug 2026", score: 48, status: "Needs review", flags: ["Photo GPS mismatch"], before: 0.31, after: 0.38, wallet: "0xe741…11ab", photo: "Field photo · 3.1 MB" },
  { id: "BC-2026-0141", ngo: "Mangrove Mission", location: "Kakinada, Andhra Pradesh", date: "25 Aug 2026", score: 57, status: "Disputed", flags: ["External challenge open"], before: 0.29, after: 0.51, wallet: "0x2be4…08c1", photo: "Field photo · 1.9 MB" },
  { id: "BC-2026-0139", ngo: "Blue Delta Foundation", location: "Bhadrak, Odisha", date: "25 Aug 2026", score: 78, status: "Provisional", flags: [], before: 0.26, after: 0.58, wallet: "0xa72f…94d0", photo: "Field photo · 2.4 MB" },
  { id: "BC-2026-0136", ngo: "Sundarbans Collective", location: "Hingalganj, West Bengal", date: "24 Aug 2026", score: 91, status: "Released", flags: [], before: 0.18, after: 0.67, wallet: "0x4cf8…2ad9", photo: "Field photo · 3.4 MB" },
];

const auditEvents = [
  ["11:42", "Verifier A. Rao", "Opened dispute", "BC-2026-0141"],
  ["10:18", "System", "Flagged NDVI anomaly", "BC-2026-0148"],
  ["09:54", "Verifier J. Singh", "Released credit after re-check", "BC-2026-0136"],
  ["Yesterday", "System", "Registered provisional credit", "BC-2026-0139"],
];

function Mark({ name }: { name: "grid" | "queue" | "shield" | "sliders" | "clock" | "logout" | "search" | "bell" | "pin" | "image" | "arrow" | "check" | "flag" | "close" }) {
  const shapes: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    queue: <><path d="M4 6h16M4 12h16M4 18h11" /><circle cx="18" cy="18" r="2" /></>,
    shield: <><path d="M12 3 20 6v5.6c0 4.7-3.2 7.8-8 9.4-4.8-1.6-8-4.7-8-9.4V6l8-3Z" /><path d="m8.4 12 2.3 2.3 5-5" /></>,
    sliders: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
    bell: <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" /></>,
    pin: <><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 18 5-5 3 3 3-3 5 5" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7L16.5 9" /></>,
    flag: <><path d="M5 21V4m0 1c5-3 7 3 14 0v9c-7 3-9-3-14 0" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };
  return <svg className="dash-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{shapes[name]}</svg>;
}

function Score({ value }: { value: number }) {
  const tone = value >= 75 ? "high" : value >= 50 ? "medium" : "low";
  return <span className={`score ${tone}`}>{value}</span>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge ${status.toLowerCase().replace(" ", "-")}`}>{status}</span>;
}

function TrendChart() {
  return (
    <div className="trend-chart" aria-label="Flagged and approved submissions trend chart">
      <div className="chart-key"><span><i className="key-approved" /> Approved</span><span><i className="key-flagged" /> Flagged</span><button type="button">Last 30 days⌄</button></div>
      <svg viewBox="0 0 690 192" preserveAspectRatio="none" role="img" aria-label="Approved submission trend rising and flagged trend low">
        <g className="chart-grid"><path d="M0 24H690M0 72H690M0 120H690M0 168H690" /></g>
        <path className="approved-area" d="M0 143 C35 138 54 132 82 137 S125 123 158 127 S204 101 237 112 S284 88 314 98 S358 67 391 77 S440 84 470 57 S515 67 548 44 S591 56 623 28 S663 32 690 15 V192 H0Z" />
        <path className="approved-line" d="M0 143 C35 138 54 132 82 137 S125 123 158 127 S204 101 237 112 S284 88 314 98 S358 67 391 77 S440 84 470 57 S515 67 548 44 S591 56 623 28 S663 32 690 15" />
        <path className="flagged-line" d="M0 163 C32 158 64 168 96 157 S148 165 180 151 S231 159 264 146 S317 153 345 141 S400 152 428 135 S482 143 512 129 S566 144 596 121 S651 136 690 112" />
      </svg>
      <div className="chart-days"><span>28 Jul</span><span>04 Aug</span><span>11 Aug</span><span>18 Aug</span><span>25 Aug</span></div>
    </div>
  );
}

export default function NccrDashboard() {
  const [view, setView] = useState<View>("Overview");
  const [selectedId, setSelectedId] = useState("BC-2026-0148");
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(submissions);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.05);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  const queue = useMemo(() => rows
    .filter((item) => statusFilter === "All" || item.status === statusFilter)
    .filter((item) => `${item.id} ${item.ngo} ${item.location} ${item.flags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.score - b.score), [query, rows, statusFilter]);

  const decide = (next: Status) => {
    setRows((current) => current.map((item) => item.id === selected.id ? { ...item, status: next } : item));
    setDecision(next === "Provisional" ? "Approved as provisional" : next === "Rejected" ? "Submission rejected" : "Dispute opened");
  };

  const navigation: Array<[View, "grid" | "queue" | "shield" | "sliders" | "clock"]> = [["Overview", "grid"], ["Review queue", "queue"], ["Disputes", "shield"], ["Rules", "sliders"], ["Audit trail", "clock"]];

  return (
    <div className="nccr-app">
      <aside className="nccr-sidebar">
        <a className="nccr-logo" href="/"><span className="nccr-logo-mark" /><span><b>NCCR</b><small>Blue Carbon Registry</small></span></a>
        <nav aria-label="Dashboard navigation">
          <p>Workspace</p>
          {navigation.map(([label, icon]) => <button className={view === label ? "active" : ""} onClick={() => { setView(label); setDecision(null); }} type="button" key={label}><Mark name={icon} />{label}{label === "Review queue" && <em>3</em>}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="verifier-avatar">AR</div><div><b>Ananya Rao</b><small>Lead verifier</small></div><button aria-label="Sign out" type="button"><Mark name="logout" /></button></div>
      </aside>

      <main className="nccr-main">
        <header className="dashboard-header"><div><span className="environment-dot" /> Sepolia testnet <span className="header-divider" /> Updated moments ago</div><div className="header-tools"><button type="button" aria-label="Search"><Mark name="search" /></button><button type="button" aria-label="Notifications" className="notification"><Mark name="bell" /><i /></button><a href="/public">Public site <Mark name="arrow" /></a></div></header>

        {view === "Overview" && <section className="dashboard-page overview-page">
          <div className="page-title"><div><p className="overline">NCCR verification desk</p><h1>Good morning, Ananya.</h1><p>Three submissions need your attention before new credits can move forward.</p></div><button className="dark-action" onClick={() => setView("Review queue")} type="button">Open review queue <Mark name="arrow" /></button></div>
          <div className="metric-grid">
            <article><span>Total submissions</span><strong>1,248</strong><small>+12.4% <i>vs. previous 30 days</i></small></article>
            <article className="attention"><span>Flagged for review</span><strong>03</strong><small>2 need action today</small></article>
            <article><span>Active disputes</span><strong>12</strong><small>4 awaiting resolution</small></article>
            <article><span>Credits released</span><strong>876</strong><small>+18 this week</small></article>
          </div>
          <div className="overview-grid">
            <article className="dashboard-card trend-card"><div className="card-title"><div><p>Verification activity</p><span>Approved and flagged submissions</span></div></div><TrendChart /></article>
            <article className="dashboard-card attention-card"><div className="card-title"><div><p>Priority review</p><span>Lowest plausibility scores first</span></div><button onClick={() => setView("Review queue")} type="button">View all</button></div>{rows.filter((row) => row.status === "Needs review").slice(0, 3).map((row) => <button className="mini-review" onClick={() => { setSelectedId(row.id); setView("Review queue"); }} type="button" key={row.id}><Score value={row.score} /><span><b>{row.ngo}</b><small>{row.flags[0]}</small></span><Mark name="arrow" /></button>)}</article>
          </div>
          <section className="dashboard-card audit-preview"><div className="card-title"><div><p>Latest audit activity</p><span>Every lifecycle action is recorded</span></div><button onClick={() => setView("Audit trail")} type="button">Full history</button></div>{auditEvents.map(([time, actor, action, id]) => <div className="audit-row" key={`${time}${id}`}><time>{time}</time><span><b>{actor}</b> {action}</span><code>{id}</code></div>)}</section>
        </section>}

        {view === "Review queue" && <section className="dashboard-page review-page">
          <div className="page-title"><div><p className="overline">Verifier workflow</p><h1>Review queue</h1><p>Submissions ranked by NDVI plausibility score and evidence conflicts.</p></div><div className="queue-count">{queue.length} in queue</div></div>
          <div className="queue-toolbar"><label><Mark name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search submission, NGO, or location" /></label><div className="filter-pills">{(["All", "Needs review", "Disputed", "Provisional"] as const).map((filter) => <button className={statusFilter === filter ? "selected" : ""} onClick={() => setStatusFilter(filter)} type="button" key={filter}>{filter}</button>)}</div></div>
          <div className="review-layout"><section className="queue-table"><div className="table-head"><span>Submission</span><span>Score</span><span>Signals</span><span>State</span></div>{queue.map((row) => <button className={`queue-row ${selected.id === row.id ? "selected" : ""}`} onClick={() => { setSelectedId(row.id); setDecision(null); }} type="button" key={row.id}><span><b>{row.id}</b><small>{row.ngo} · {row.location}</small></span><Score value={row.score} /><span className="flag-list">{row.flags.length ? row.flags.slice(0, 2).map((flag) => <i key={flag}>{flag}</i>) : <i className="clean">No conflicts</i>}</span><StatusBadge status={row.status} /></button>)}</section>
          <SubmissionDetail submission={selected} note={note} setNote={setNote} decision={decision} decide={decide} /></div>
        </section>}

        {view === "Disputes" && <section className="dashboard-page disputes-page"><div className="page-title"><div><p className="overline">Challenge workflow</p><h1>Dispute management</h1><p>Open challenges pause credit progression until evidence is resolved by a verifier.</p></div></div><div className="dispute-grid">{rows.filter((row) => row.status === "Disputed").map((row) => <article className="dispute-card" key={row.id}><div><StatusBadge status="Disputed" /><span>{row.id}</span></div><h2>{row.ngo}</h2><p><Mark name="pin" /> {row.location}</p><div className="dispute-evidence"><b>Challenge statement</b><span>“Ground evidence conflicts with the reported survival rate in this site.”</span></div><button className="dark-action" onClick={() => { setSelectedId(row.id); setView("Review queue"); }} type="button">Resolve dispute <Mark name="arrow" /></button></article>)}<article className="dispute-empty"><Mark name="shield" /><h2>Disputes are public safeguards.</h2><p>Authorized disputer evidence and resolution actions stay linked to the on-chain record.</p></article></div></section>}

        {view === "Rules" && <section className="dashboard-page rules-page"><div className="page-title"><div><p className="overline">Scoring controls</p><h1>Verification rules</h1><p>Rules complement the satellite score so reviewers can adapt to local evidence conditions.</p></div><button className="dark-action" type="button">Publish changes <Mark name="arrow" /></button></div><div className="rules-list"><article><div><span className="rule-number">01</span><h2>Minimum NDVI increase</h2><p>Flag when post-planting vegetation gain is below the threshold.</p></div><label><input aria-label="Minimum NDVI increase" type="range" min="0.01" max="0.20" step="0.01" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><output>{threshold.toFixed(2)}</output></label></article><article><div><span className="rule-number">02</span><h2>Photo GPS tolerance</h2><p>Flag field photos beyond 1 km of the declared planting site.</p></div><span className="rule-value">1,000 m</span></article><article><div><span className="rule-number">03</span><h2>EXIF date tolerance</h2><p>Flag evidence captured more than 45 days from its claimed planting date.</p></div><span className="rule-value">45 days</span></article></div></section>}

        {view === "Audit trail" && <section className="dashboard-page audit-page"><div className="page-title"><div><p className="overline">Accountability ledger</p><h1>Audit trail</h1><p>A reviewable history of automated flags and verifier actions.</p></div></div><section className="audit-table"><div className="audit-table-head"><span>When</span><span>Actor</span><span>Action</span><span>Submission</span></div>{auditEvents.concat([["24 Aug, 17:14", "Verifier A. Rao", "Rejected photo metadata", "BC-2026-0127"], ["23 Aug, 08:20", "System", "Created score record", "BC-2026-0123"]]).map(([time, actor, action, id]) => <div className="audit-table-row" key={`${time}${id}`}><time>{time}</time><b>{actor}</b><span>{action}</span><code>{id}</code></div>)}</section></section>}
      </main>
    </div>
  );
}

function SubmissionDetail({ submission, note, setNote, decision, decide }: { submission: Submission; note: string; setNote: (value: string) => void; decision: string | null; decide: (status: Status) => void }) {
  const max = 0.8;
  return <aside className="submission-detail"><div className="detail-top"><div><p className="overline">Evidence review</p><h2>{submission.id}</h2></div><StatusBadge status={submission.status} /></div><div className="detail-location"><Mark name="pin" /><span>{submission.location}<small>Submitted {submission.date}</small></span></div><div className="ndvi-block"><div className="ndvi-title"><div><b>NDVI evidence</b><span>Satellite comparison</span></div><Score value={submission.score} /></div><div className="ndvi-values"><div><span>Before planting</span><b>{submission.before.toFixed(2)}</b><i style={{ width: `${submission.before / max * 100}%` }} /></div><Mark name="arrow" /><div><span>Current window</span><b>{submission.after.toFixed(2)}</b><i className="after" style={{ width: `${submission.after / max * 100}%` }} /></div></div><div className="ndvi-caption"><span>30-day planting window</span><span>30-day current window</span></div></div><div className="detail-evidence"><article><Mark name="image" /><span><b>{submission.photo}</b><small>Decoded EXIF attached</small></span><button type="button">Preview</button></article><article><span className="metadata-label">Beneficiary wallet</span><code>{submission.wallet}</code></article></div><div className="flag-summary"><b>Review signals</b>{submission.flags.length ? submission.flags.map((flag) => <span key={flag}><Mark name="flag" />{flag}</span>) : <span className="no-flags"><Mark name="check" />No automated conflicts</span>}</div><label className="rationale"><span>Decision rationale <em>Required for review actions</em></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the evidence and your decision…" /></label>{decision && <p className="decision-feedback"><Mark name="check" /> {decision} and added to the audit trail.</p>}<div className="review-actions"><button className="approve" disabled={!note} onClick={() => decide("Provisional")} type="button">Approve <Mark name="check" /></button><button className="dispute" disabled={!note} onClick={() => decide("Disputed")} type="button">Escalate dispute <Mark name="flag" /></button><button className="reject" disabled={!note} onClick={() => decide("Rejected")} type="button">Reject <Mark name="close" /></button></div></aside>;
}
