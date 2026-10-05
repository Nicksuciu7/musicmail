"use client";
import { useState } from "react";
import { request } from "@/lib/client";

type Row = Record<string, unknown>;
type Page = { items: Row[]; total: number };
const sections = [
  "contacts",
  "notes",
  "lists",
  "list_members",
  "saved_views",
  "interactions",
  "email_metadata",
  "calendar_events",
  "equipment",
  "gmail_status",
];
export function AdminSupport() {
  const [view, setView] = useState("users");
  const [workspaceId, setWorkspaceId] = useState("");
  const [section, setSection] = useState("contacts");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Page>();
  const [detail, setDetail] = useState<Row>();
  const [role, setRole] = useState("member");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load(nextOffset = 0) {
    setBusy(true);
    setMessage("");
    setDetail(undefined);
    setConfirmed(false);
    try {
      const params = new URLSearchParams({ view, offset: String(nextOffset) });
      if (view === "records") {
        params.set("workspaceId", workspaceId);
        params.set("section", section);
      }
      const result = await request<Page>(`/api/admin/support?${params}`);
      setData(result);
      setOffset(nextOffset);
    } catch (error) {
      setData(undefined);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changeRole() {
    if (!detail) return;
    setBusy(true);
    setMessage("");
    try {
      await request("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.id, role, confirmed }),
      });
      setDetail(undefined);
      setConfirmed(false);
      setData(undefined);
      setMessage("Role changed. The action was recorded in the audit log.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Account and workspace support</h2>
      <p>
        Private support reads and role changes are audited. Workspace records
        are read-only here. Email history shows metadata; Gmail shows connection
        status only.
      </p>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Support records</legend>
        <label className="field">
          View
          <select
            aria-label="View"
            value={view}
            onChange={(e) => {
              setView(e.target.value);
              setData(undefined);
              setDetail(undefined);
              setConfirmed(false);
              setMessage("");
            }}
          >
            <option value="users">Users</option>
            <option value="workspaces">Workspaces</option>
            <option value="records">Workspace records</option>
            <option value="audit">Audit log</option>
          </select>
        </label>
        {view === "records" && (
          <>
            <label className="field">
              Workspace UUID
              <input
                value={workspaceId}
                onChange={(e) => {
                  setWorkspaceId(e.target.value);
                  setData(undefined);
                }}
              />
            </label>
            <label className="field">
              Record category
              <select
                aria-label="Record category"
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  setData(undefined);
                }}
              >
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className="button primary" onClick={() => void load()}>
          {busy ? "Loading…" : "Load support records"}
        </button>
        {message && <p role="status">{message}</p>}
        {data && (
          <>
            <p role="status">
              {data.total} records. Showing {data.items.length ? offset + 1 : 0}
              –{offset + data.items.length}.
            </p>
            <div className="stack">
              {data.items.map((row, index) => (
                <article key={String(row.id || index)} className="source-box">
                  <strong>
                    {String(
                      row.email ||
                        row.name ||
                        row.private_display_name ||
                        row.title ||
                        row.action ||
                        row.label ||
                        row.id ||
                        "Record",
                    )}
                  </strong>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      fontSize: "0.85rem",
                    }}
                  >
                    {JSON.stringify(row, null, 2)}
                  </pre>
                  {view === "users" && (
                    <button
                      className="button small"
                      onClick={() => {
                        setDetail(row);
                        setRole(String(row.role));
                        setConfirmed(false);
                      }}
                    >
                      Manage role for {String(row.email)}
                    </button>
                  )}
                  {view === "workspaces" && (
                    <button
                      className="button small"
                      onClick={() => {
                        setWorkspaceId(String(row.id));
                        setView("records");
                        setData(undefined);
                        setDetail(undefined);
                      }}
                    >
                      Inspect workspace
                    </button>
                  )}
                </article>
              ))}
            </div>
            <div className="actions">
              <button
                className="button"
                disabled={!offset}
                onClick={() => void load(Math.max(0, offset - 50))}
              >
                Previous page
              </button>
              <button
                className="button"
                disabled={offset + 50 >= data.total}
                onClick={() => void load(offset + 50)}
              >
                Next page
              </button>
            </div>
          </>
        )}
        {detail && (
          <div className="source-box">
            <h3>Change role: {String(detail.email)}</h3>
            <p>User UUID: {String(detail.id)}</p>
            <p>
              You cannot change your own role. Role changes take effect on
              subsequent requests.
            </p>
            <label className="field">
              New account role
              <select
                aria-label="New account role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I confirm this account should have the selected role.
            </label>
            <button
              className="button danger"
              disabled={!confirmed || role === detail.role}
              onClick={() => void changeRole()}
            >
              Confirm role change
            </button>
          </div>
        )}
      </fieldset>
    </section>
  );
}
