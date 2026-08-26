import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import heroImage from "./assets/hero-mangrove.jpg";

type IconName = "pin" | "satellite" | "lock" | "check" | "shield" | "ledger";

function useReveal(): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.classList.add("is-revealed");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.classList.add("is-revealed");
          observer.unobserve(element);
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    pin: <><path d="M12 21s6-5.05 6-11a6 6 0 1 0-12 0c0 5.95 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    satellite: <><path d="m13.5 6.5 4 4M6.5 17.5l4-4M5 19l2 2 5-5-2-2-5 5ZM14 10l2 2 5-5-2-2-5 5Z" /><path d="M12 12 9 9m3 3 3 3M4 8l2-2m12 12 2-2" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7L16.5 9" /></>,
    shield: <><path d="M12 3.5 19 6v5.2c0 4.2-2.8 7.6-7 9.3-4.2-1.7-7-5.1-7-9.3V6l7-2.5Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
    ledger: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  };

  return <svg className="line-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">{paths[name]}</svg>;
}

const navigation = [
  ["How it works", "#how-it-works"],
  ["Public registry", "#public-registry"],
  ["For NGOs", "#for-ngos"],
  ["For verifiers", "#for-verifiers"],
] as const;

const steps: Array<{ number: string; title: string; description: string; icon: IconName }> = [
  { number: "01", title: "Submit evidence", description: "A field team records a location, planting date, photo evidence, and beneficiary wallet.", icon: "pin" },
  { number: "02", title: "Cross-check", description: "Satellite NDVI and EXIF checks assess whether the restoration claim is plausible.", icon: "satellite" },
  { number: "03", title: "Hold provisionally", description: "A verified credit is issued on-chain, but remains locked during its survival period.", icon: "lock" },
  { number: "04", title: "Release with confidence", description: "A clean re-verification and human approval make the credit transferable.", icon: "check" },
];

export default function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const problemRef = useReveal();
  const processRef = useReveal();
  const registryRef = useReveal();
  const rolesRef = useReveal();
  const alignmentRef = useReveal();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell" id="top">
      <header className={`site-header ${isScrolled ? "has-scrolled" : ""}`}>
        <div className="page-frame nav-frame">
          <a className="brand" href="#top" aria-label="Blue Carbon MRV home" onClick={closeMenu}>
            <span className="brand-mark" aria-hidden="true"><span /></span><span>Blue Carbon MRV</span>
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navigation.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
          </nav>
          <div className="nav-actions">
            <button className={`wallet-button ${walletConnected ? "is-connected" : ""}`} onClick={() => setWalletConnected((connected) => !connected)} type="button">
              {walletConnected ? <><span className="wallet-dot" />0x7a3…f9e2</> : "Connect wallet"}
            </button>
            <button className="menu-button" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
          </div>
        </div>
        <nav className={`mobile-nav ${menuOpen ? "is-open" : ""}`} aria-label="Mobile navigation">
          {navigation.map(([label, href]) => <a href={href} key={href} onClick={closeMenu}>{label}</a>)}
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <img className="hero-image" src={heroImage} alt="Aerial mangrove waterways along the coast" />
          <div className="hero-wash" />
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-orbit" aria-hidden="true"><i /><i /><span /></div>
          <div className="page-frame hero-content">
            <p className="eyebrow hero-eyebrow">Satellite evidence · on-chain accountability</p>
            <h1 id="hero-heading">Carbon credits that wait for the truth.</h1>
            <p className="hero-copy">Blue Carbon MRV verifies mangrove restoration against satellite and field evidence before a credit can become tradeable.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#how-it-works">Submit a restoration project <span aria-hidden="true">↗</span></a>
              <a className="ghost-button" href="#public-registry">View public registry</a>
            </div>
          </div>
          <a className="scroll-cue" href="#problem" aria-label="Scroll to the problem section"><span>Scroll to explore</span><i /></a>
        </section>

        <section className="section" id="problem" ref={problemRef as RefObject<HTMLElement>}>
          <div className="page-frame reveal">
            <div className="section-intro split-intro">
              <div><p className="eyebrow">The verification gap</p><h2>Restoration can be real. Claims still need proof.</h2></div>
              <p className="intro-copy">Carbon markets work only when a credit represents something that happened. A timestamp and a spreadsheet cannot establish that a mangrove was planted, survived, or belongs at the claimed location.</p>
            </div>
            <div className="principle-grid" aria-label="Core verification principles">
              <article className="principle-card"><span>01</span><h3>Evidence before issuance</h3><p>Location, imagery, and field evidence are reviewed before an on-chain credit is created.</p></article>
              <article className="principle-card"><span>02</span><h3>Locked before release</h3><p>Provisional credits are non-transferable until re-verification confirms the restoration outcome.</p></article>
              <article className="principle-card"><span>03</span><h3>Challenge in public</h3><p>Suspicious provisional claims can be disputed before they mature into a final credit.</p></article>
            </div>
          </div>
        </section>

        <section className="section process-section" id="how-it-works" ref={processRef as RefObject<HTMLElement>}>
          <div className="page-frame reveal">
            <div className="section-heading centered-heading"><p className="eyebrow">How it works</p><h2>One deliberate path from field to registry.</h2><p>Every state change has an evidence trail, a responsible actor, and a clear reason for happening.</p></div>
            <div className="process-panel"><div className="process-line" aria-hidden="true" />
              {steps.map((step) => <article className="process-step" key={step.number}><div className="step-topline"><span>{step.number}</span><Icon name={step.icon} /></div><h3>{step.title}</h3><p>{step.description}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section registry-section" id="public-registry" ref={registryRef as RefObject<HTMLElement>}>
          <div className="page-frame registry-layout reveal">
            <div className="registry-copy"><p className="eyebrow">Trust & transparency</p><h2>Every provisional claim stays open to scrutiny.</h2><p>Before release, authorized parties can flag a material conflict in the evidence. A dispute pauses the lifecycle until a verifier restores or rejects the credit on-chain.</p><a className="text-link" href="#how-it-works">See the verification lifecycle <span aria-hidden="true">→</span></a></div>
            <div className="registry-card" aria-label="Illustrative public registry preview">
              <div className="registry-card-top"><div><p className="card-kicker">Public registry</p><strong>Testnet preview</strong></div><span className="status-pill"><i /> Demo data</span></div>
              <div className="registry-list"><div><span>Evidence record</span><strong>Geo-tagged &amp; scored</strong></div><div><span>Credit state</span><strong>Provisional · locked</strong></div><div><span>Challenge window</span><strong>Open before release</strong></div></div>
              <p className="registry-note">Registry values will be connected to live contract and scoring data.</p>
            </div>
          </div>
        </section>

        <section className="section audience-section" ref={rolesRef as RefObject<HTMLElement>}>
          <div className="page-frame reveal">
            <div className="section-heading"><p className="eyebrow">Built around accountable roles</p><h2>Useful in the field. Defensible at review.</h2></div>
            <div className="audience-grid">
              <article className="audience-card" id="for-ngos"><Icon name="pin" /><p className="card-kicker">For NGOs &amp; field teams</p><h3>Document restoration once, then follow it through.</h3><p>Capture evidence at the site, submit a project, and follow its review state from first score to released credit.</p><a className="ghost-button compact" href="#how-it-works">Project workflow <span aria-hidden="true">→</span></a></article>
              <article className="audience-card" id="for-verifiers"><Icon name="shield" /><p className="card-kicker">For verifiers &amp; auditors</p><h3>Review evidence with a public, enforceable trail.</h3><p>Assess scoring context, open a dispute when evidence conflicts, and approve lifecycle actions with role-gated controls.</p><a className="ghost-button compact" href="#public-registry">Registry controls <span aria-hidden="true">→</span></a></article>
            </div>
          </div>
        </section>

        <section className="section alignment-section" ref={alignmentRef as RefObject<HTMLElement>}>
          <div className="page-frame alignment-card reveal"><Icon name="ledger" /><div><p className="eyebrow">Institutional alignment</p><blockquote>“Verifiable infrastructure for coastal restoration deserves the same care as the ecosystems it represents.”</blockquote></div><p>Built for the Smart India Hackathon, Ministry of Earth Sciences / NCCR domain—designed to complement coastal monitoring with a transparent credit lifecycle.</p></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-frame footer-grid">
          <div><a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true"><span /></span><span>Blue Carbon MRV</span></a><p>Satellite-verified blue carbon credits for restoration that can stand up to scrutiny.</p></div>
          <div className="footer-links"><p>Explore</p>{navigation.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</div>
          <div className="contract-block"><p>Deployed contract</p><a href="https://eth-sepolia.blockscout.com/address/0x815F9122D29471e161D66068Eef9a508EC079442#code" target="_blank" rel="noreferrer">0x815F…9442 <span aria-hidden="true">↗</span></a><small>Ethereum Sepolia testnet</small></div>
        </div>
        <div className="page-frame footer-legal"><span>Blue Carbon MRV · SIH / Ministry of Earth Sciences / NCCR domain</span><span>Demonstration project · testnet credits have no monetary value</span></div>
      </footer>
    </div>
  );
}
