"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createApplication } from "@/app/actions";
import type { ApplicationHome } from "./model";

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export default function ApplicationHomeScreen({ initial }: { initial: ApplicationHome }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await createApplication({
        company: String(data.get("company") ?? ""),
        role: String(data.get("role") ?? ""),
        jobDescription: String(data.get("jobDescription") ?? ""),
      });
      router.push(`/applications/${result.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The application could not be created.");
      setSubmitting(false);
    }
  }

  const applicationCount = initial.companies.reduce((count, company) => count + company.applications.length, 0);
  return <main className="home-shell">
    <header className="home-header">
      <div><p className="eyebrow">CV workspace</p><h1>Applications</h1><p className="home-intro">Create a focused draft for each role while keeping your master CV intact.</p></div>
      <Link className="button-link" href="/master">{initial.hasMaster ? "Edit master CV" : "Create master CV"}</Link>
    </header>

    <section className="create-card" aria-labelledby="create-application-heading">
      <div className="section-heading">
        <div><p className="step-label">New application</p><h2 id="create-application-heading">Start from your master CV</h2></div>
        {!initial.hasMaster && <span className="setup-badge">Master CV required</span>}
      </div>
      <form className="application-form" onSubmit={submit}>
        <div className="form-row">
          <label>Company<input name="company" required minLength={2} maxLength={120} placeholder="Northstar Studio" autoComplete="organization" /></label>
          <label>Role<input name="role" required minLength={2} maxLength={160} placeholder="Senior Frontend Engineer" autoComplete="organization-title" /></label>
        </div>
        <label>Job description<textarea name="jobDescription" required minLength={20} maxLength={50_000} rows={10} placeholder="Paste the complete job description here…" /></label>
        <div className="form-footer">
          <p>The new draft copies your current master CV. Tailoring it will not change the master.</p>
          <button className="primary" type="submit" disabled={!initial.hasMaster || submitting}>{submitting ? "Creating…" : "Create tailored draft"}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </section>

    <section className="applications-section" aria-labelledby="your-applications-heading">
      <div className="section-heading"><div><p className="step-label">Workspace</p><h2 id="your-applications-heading">Your applications</h2></div><span>{applicationCount} total</span></div>
      {initial.companies.length === 0 ? <div className="empty-state"><h3>No applications yet</h3><p>Add a company, role, and job description to create the first tailored draft.</p></div> :
        <div className="company-list">{initial.companies.map((company) => <section className="company-group" key={company.id}>
          <div className="company-heading"><div className="company-mark" aria-hidden="true">{company.name.slice(0, 1).toUpperCase()}</div><div><h3>{company.name}</h3><p>{company.applications.length} {company.applications.length === 1 ? "application" : "applications"}</p></div></div>
          <div className="application-list">{company.applications.map((application) => <article className="application-card" key={application.id}>
            <div><h4>{application.role}</h4><p>{application.jobDescription}</p><span>Added {dateFormatter.format(new Date(application.updatedAt))}</span></div>
            <Link className="button-link secondary" href={`/applications/${application.id}`}>Open draft</Link>
          </article>)}</div>
        </section>)}</div>}
    </section>
  </main>;
}
