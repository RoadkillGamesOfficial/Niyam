import Link from "next/link";
import { COPY, PRODUCT_NAME } from "@/copy";
import type { HeaderStatus } from "./day-status";
import { CompassIcon, GearIcon, LedgerIcon, SunIcon } from "./sprites";

export type HeaderSection = "today" | "reframe" | "insights" | "settings";

const TABS = [
  { section: "reframe", href: "/reframe", label: COPY.reframe.nav, Icon: CompassIcon },
  { section: "insights", href: "/insights", label: COPY.nav.insights, Icon: LedgerIcon },
  { section: "settings", href: "/settings", label: COPY.nav.settings, Icon: GearIcon },
] as const;

/**
 * The shared wooden sign, inventory tabs and day plaque. This is chrome only:
 * it takes its date and plan state from the page that already read them.
 */
export function SiteHeader({
  active,
  title,
  lede,
  date,
  status,
  statusState = "closed",
  hint,
}: {
  active: HeaderSection;
  title: string;
  lede?: string;
  date: string;
  status?: string;
  statusState?: HeaderStatus;
  hint?: string;
}) {
  return (
    <header className="masthead">
      <div className="masthead-bar">
        <div className="brand-lockup">
          <span className="brand-chains" aria-hidden="true">
            <span />
            <span />
          </span>
          <Link className="brand-sign" href="/" aria-label={`${PRODUCT_NAME} — ${COPY.nav.home}`}>
            {PRODUCT_NAME}
          </Link>
          <p className="brand-tagline">{COPY.home.lede}</p>
        </div>

        <nav className="inventory-tabs" aria-label={COPY.nav.sectionsLabel}>
          {TABS.map(({ section, href, label, Icon }) => (
            <Link
              className={`inventory-tab${active === section ? " is-active" : ""}`}
              href={href}
              key={section}
              aria-current={active === section ? "page" : undefined}
              aria-label={label}
            >
              <Icon className="tab-icon" />
              <span className="tab-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="day-plaque">
          <SunIcon className="day-sun" />
          <span className="day-date">
            {COPY.home.dayLabel} {COPY.home.daySeparator} {date}
          </span>
          {status ? (
            <span className={`status status-${statusState}`}>
              <span className="status-dot" aria-hidden="true" />
              {status}
            </span>
          ) : null}
        </div>
      </div>

      <div className="page-intro">
        <h1 className="page-title">{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        {hint ? <p className="hint">{hint}</p> : null}
      </div>
    </header>
  );
}
