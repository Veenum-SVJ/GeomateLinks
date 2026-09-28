// Getting Started — an in-CMS tutorial: the whole platform in one workflow
// (enquiry → CRM → quotation → project → field work with equipment →
// documents → delivery), per-module walkthroughs and the daily rhythms.
// Static content — no API — so it can never break as modules evolve.
import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight, Users, ReceiptText, HardHat, Files, Wrench, LayoutDashboard,
  Circle, ClipboardList, Gauge, Download, Archive, Mails,
  FileText, Undo2, GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Step = { title: string; body: string; href: string; cta: string }

const WORKFLOW: Step[] = [
  {
    title: "1 · Enquiry arrives",
    body: "A website contact form submission lands in Messages. Read it, then turn it into a lead — the enquiry text comes across automatically.",
    href: "/admin/messages",
    cta: "Open Messages",
  },
  {
    title: "2 · Work the lead in the CRM",
    body: "Track calls, meetings and follow-ups on the lead's timeline. Move it through Qualified → Quotation Sent → Won. Convert it into a client when they commit.",
    href: "/admin/crm",
    cta: "Open CRM",
  },
  {
    title: "3 · Quote the job",
    body: "Build the quotation from service line items — pricing, discounts, VAT and terms are all handled. Send or print it; accept it when the client signs.",
    href: "/admin/quotations",
    cta: "Open Quotations",
  },
  {
    title: "4 · Create the project",
    body: "One click from the accepted quotation: client, scope, value and service carry across. Set the team, milestones, tasks and timeline.",
    href: "/admin/pms",
    cta: "Open Projects",
  },
  {
    title: "5 · Field work — with equipment",
    body: "Assign instruments and drones to the project (and to staff), record pre-field inspections, and reserve gear for future jobs. Returns update condition automatically.",
    href: "/admin/equipment",
    cta: "Open Equipment",
  },
  {
    title: "6 · Collect the documents",
    body: "Field data, maps, CAD and reports live in the Document Management System under the project — versioned, tagged, and linkable to equipment certificates.",
    href: "/admin/documents",
    cta: "Open Documents",
  },
  {
    title: "7 · Deliver and publish",
    body: "Complete the project, attach final deliverables, and optionally publish it to the public portfolio when it is ready to show.",
    href: "/admin/pms/all",
    cta: "Open Projects",
  },
]

const MODULES: { name: string; href: string; icon: React.ReactNode; blurb: string; steps: string[] }[] = [
  {
    name: "Dashboard", href: "/admin", icon: <LayoutDashboard className="h-4 w-4" />,
    blurb: "Your morning overview.",
    steps: [
      "Unread messages, CRM pipeline, active projects and alerts in one place.",
      "Use it to decide what today needs — then jump straight into a module.",
    ],
  },
  {
    name: "CRM", href: "/admin/crm", icon: <Users className="h-4 w-4" />,
    blurb: "Leads, clients, follow-ups, activities.",
    steps: [
      "Every enquiry becomes a lead; every won lead becomes a client.",
      "Log every call/meeting as an activity — the timeline is the memory.",
      "Follow-ups surface on the CRM dashboard so nobody is forgotten.",
    ],
  },
  {
    name: "Quotations", href: "/admin/quotations", icon: <ReceiptText className="h-4 w-4" />,
    blurb: "Priced proposals with revisions.",
    steps: [
      "Create from a lead or client; add service line items.",
      "Revisions keep the full history — clients see only the current version.",
      "Accepting a quotation unlocks project creation.",
    ],
  },
  {
    name: "Project Management", href: "/admin/pms", icon: <HardHat className="h-4 w-4" />,
    blurb: "Delivery: tasks, milestones, team, deliverables.",
    steps: [
      "Prefer creating projects from accepted quotations — everything links up.",
      "Work statuses drive progress automatically; overdue alerts appear on dashboards.",
      "The Equipment tab shows which instruments are out on this project.",
    ],
  },
  {
    name: "Equipment", href: "/admin/equipment", icon: <Wrench className="h-4 w-4" />,
    blurb: "Instruments, drones and field kit.",
    steps: [
      "Register each item once — asset numbers (GML-GNSS-001) are generated per category.",
      "The lifecycle: Assign → used on a project → Return → Maintenance/Calibration → Available again.",
      "Reserved items show as Reserved; conflicting bookings are refused with an explanation.",
      "Certificates and manuals attach through Documents with the equipment:<asset> tag.",
    ],
  },
  {
    name: "Documents", href: "/admin/documents", icon: <Files className="h-4 w-4" />,
    blurb: "Project files, versioned.",
    steps: [
      "Every document belongs to a project — upload through the project or the Documents area.",
      "Versions are append-only; archiving never deletes.",
      "Tag equipment files with equipment:<asset number> to link them to a machine.",
    ],
  },
  {
    name: "Website content", href: "/admin/pages", icon: <FileText className="h-4 w-4" />,
    blurb: "Public site: pages, services, portfolio, media.",
    steps: [
      "Pages edits the homepage copy; Services and Portfolio feed the public site.",
      "Portfolio projects are published from completed internal projects.",
      "Media holds the site's images and video.",
    ],
  },
]

const UndoIcon = () => <Undo2 className="h-4 w-4" />

const DAILY: { title: string; icon: React.ReactNode; items: string[] }[] = [
  {
    title: "When an enquiry arrives",
    icon: <Mails className="h-4 w-4" />,
    items: ["Messages → read → Create lead.", "Log a first call activity in the CRM.", "Set a follow-up date."],
  },
  {
    title: "When a job is won",
    icon: <ReceiptText className="h-4 w-4" />,
    items: ["Quotation → mark Accepted.", "Create project from the quotation.", "Add the team and milestones."],
  },
  {
    title: "Before field work",
    icon: <ClipboardList className="h-4 w-4" />,
    items: ["Project → Equipment tab → Assign equipment.", "Record a Pre-field inspection on each instrument.", "Check calibration dates are valid."],
  },
  {
    title: "When kit comes back",
    icon: <UndoIcon />,
    items: ["Project → Equipment → Return (condition + damage).", "Anything flagged: record maintenance from the profile.", "Damaged kit shows on the dashboard until fixed."],
  },
  {
    title: "Monthly hygiene",
    icon: <Gauge className="h-4 w-4" />,
    items: ["Equipment → Reports → Calibration Due.", "Maintenance page → clear anything overdue.", "CRM → Follow-ups → clear the backlog."],
  },
]

export default function GettingStartedPage() {
  const [openModule, setOpenModule] = useState<string | null>("Equipment")

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-brand-dark">
          <GraduationCap className="h-5 w-5 text-brand-brown" /> Getting Started
        </h1>
        <p className="text-sm text-muted-foreground">
          How the whole platform fits together — the workflow, each module, and the daily rhythms.
        </p>
      </div>

      {/* The big picture */}
      <section className="rounded-lg border bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">The workflow, end to end</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One enquiry flows through the entire platform. Every module hands off to the next.
        </p>
        <ol className="mt-4 space-y-3">
          {WORKFLOW.map((step, i) => (
            <li key={step.title} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-brown font-mono text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                {i < WORKFLOW.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="flex-1 rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-brand-dark">{step.title}</h3>
                  <Link to={step.href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline">
                    {step.cta} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Modules */}
      <section className="rounded-lg border bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">The modules</h2>
        <div className="mt-3 space-y-2">
          {MODULES.map((m) => {
            const open = openModule === m.name
            return (
              <div key={m.name} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setOpenModule(open ? null : m.name)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-brand-brown">{m.icon}</span>
                    <span className="text-sm font-medium text-brand-dark">{m.name}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">— {m.blurb}</span>
                  </span>
                  <span className={cn("text-muted-foreground transition-transform", open && "rotate-90")}>›</span>
                </button>
                {open && (
                  <div className="border-t px-4 py-3">
                    <ul className="space-y-1.5">
                      {m.steps.map((s) => (
                        <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Circle className="mt-1.5 h-1.5 w-1.5 shrink-0 fill-current text-brand-brown" />
                          {s}
                        </li>
                      ))}
                    </ul>
                    <Link to={m.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline">
                      Open {m.name} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Daily rhythms */}
      <section className="rounded-lg border bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Daily rhythms</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {DAILY.map((d) => (
            <div key={d.title} className="rounded-lg border bg-muted/20 p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">{d.icon}{d.title}</h3>
              <ol className="mt-2 space-y-1">
                {d.items.map((item, i) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="font-mono text-[10px] text-brand-brown">{i + 1}.</span> {item}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Pointers */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><Wrench className="h-4 w-4 text-brand-brown" /> Asset numbers</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Format <code className="rounded bg-muted px-1 font-mono text-[11px]">GML-&lt;category&gt;-NNN</code> — unique, permanent, printed on the kit. Serial numbers are tracked separately.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><Download className="h-4 w-4 text-brand-brown" /> Reports</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Equipment → Reports gives inventory, assignments, maintenance and calibration views — each downloadable as CSV.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><Archive className="h-4 w-4 text-brand-brown" /> Nothing is ever lost</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Archive and Retire keep full history. A weekly automatic backup runs in the background — restore tooling is ready if ever needed.
          </p>
        </div>
      </section>
    </div>
  )
}


