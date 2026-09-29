"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Mail,
  Download,
  LogOut,
  Trash2,
  Upload,
} from "lucide-react";
import { Heading, Avatar, Empty } from "./common";
import { Dialog } from "./ui/dialog";
import { request, updateWorkspace } from "@/lib/client";
import {
  contactName,
  contactEmail,
  type Workspace,
  type Contact,
  type Action,
  type Filters,
  type Template,
} from "@/lib/domain";
export function Home({
  w,
  onOpen,
  onNew,
  onImport,
  onView,
  onCompose,
}: {
  w: Workspace;
  onOpen: (c: Contact) => void;
  onNew: () => void;
  onImport: () => void;
  onView: (f: Filters, target?: string, columns?: string[]) => void;
  onCompose: () => void;
}) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: w.profile?.timezone || "Europe/London",
  });
  const due = w.contacts
    .filter((c) => !c.archived && c.follow_up_at && c.follow_up_at <= today)
    .sort((a, b) => a.follow_up_at!.localeCompare(b.follow_up_at!));
  const upcoming = w.contacts
    .filter((c) => !c.archived && c.follow_up_at && c.follow_up_at > today)
    .sort((a, b) => a.follow_up_at!.localeCompare(b.follow_up_at!))
    .slice(0, 5);
  const row = (c: Contact) => (
    <div className="list-row" key={c.id}>
      <Avatar name={contactName(c)} />
      <div className="list-row-main">
        <button className="entity-name" onClick={() => onOpen(c)}>
          {contactName(c)}
        </button>
        <p>
          {c.follow_up_at
            ? `Follow up ${new Date(c.follow_up_at + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
            : c.entity?.organisation_type || "Recently added"}
        </p>
      </div>
      <button
        className="icon-button"
        aria-label={`Open ${contactName(c)}`}
        onClick={() => onOpen(c)}
      >
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
  return (
    <>
      <Heading title="Home" description="What needs your attention?">
        <Link className="button primary" href="/explore">
          Find your people <ArrowUpRight size={14} />
        </Link>
      </Heading>
      {!w.onboarded && (
        <p className="setup-prompt">
          <Link href="/onboarding">Set up your artist profile →</Link>
        </p>
      )}
      <div className="attention-grid">
        <div className="attention-stack">
          <section className="panel">
            <div className="panel-header">
              <h3>Follow-ups due</h3>
            </div>
            {due.length ? due.map(row) : <p>No follow-ups due.</p>}
            {upcoming.length > 0 && (
              <details className="disclosure">
                <summary>Upcoming follow-ups</summary>
                {upcoming.map(row)}
              </details>
            )}
          </section>
          <section className="panel">
            <h3>Recently emailed</h3>
            {w.sent.length ? (
              w.sent.slice(0, 5).map((e) => (
                <div className="list-row" key={e.id}>
                  <Mail size={16} />
                  <div>
                    <strong>{e.subject}</strong>
                    <p>{e.recipient}</p>
                  </div>
                </div>
              ))
            ) : (
              <p>No messages sent through MusicMail yet.</p>
            )}
          </section>
        </div>
        <div className="attention-stack">
          <section className="panel">
            <h3>Quick actions</h3>
            <div className="actions">
              <button className="button small" onClick={onNew}>
                <Plus size={13} />
                Add contact
              </button>
              <button className="button small" onClick={onImport}>
                <Upload size={13} />
                Import CSV
              </button>
              <button className="button small" onClick={onCompose}>
                <Mail size={13} />
                Compose email
              </button>
            </div>
          </section>
          <section className="panel">
            <h3>Recent contacts</h3>
            {w.contacts
              .filter((c) => !c.archived)
              .slice(0, 4)
              .map(row)}
            {!w.contacts.length && (
              <p>
                Your network starts with one hello. Discover someone in Explore.
              </p>
            )}
          </section>
          <section className="panel">
            <h3>Your saved views</h3>
            {!!w.views.length && (
              <select
                className="filter-select"
                aria-label="Saved view"
                value=""
                onChange={(event) => {
                  const view = w.views.find((v) => v.id === event.target.value);
                  if (view)
                    onView(
                      view.filter_definition,
                      view.scope,
                      view.visible_columns,
                    );
                }}
              >
                <option value="">Choose a view…</option>
                {w.views.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
            {!w.views.length && (
              <p>
                Save your favourite filters in Explore or My Network to find
                your way back.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
export function Lists({
  w,
  onSelect,
  mutate,
}: {
  w: Workspace;
  onSelect: (id: string) => void;
  mutate: (a: Action) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <Heading
        title="Lists"
        description="Group the people you want to reach."
      />
      <form
        className="search-row"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mutate({ action: "list", name });
            setName("");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <input
          className="text-input"
          aria-label="New list name"
          placeholder="Give your next list a name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
        <button className="button primary">
          <Plus size={14} />
          Create list
        </button>
      </form>
      {error && <div className="error-banner">{error}</div>}
      {w.lists.length ? (
        <div className="simple-list">
          {w.lists.map((l) => (
            <article className="list-row" key={l.id}>
              <div className="list-row-main">
                <h3>
                  <button
                    className="entity-name"
                    onClick={() => onSelect(l.id)}
                  >
                    {l.name}
                  </button>
                </h3>
                <p>
                  {l.member_count ??
                    w.members.filter((m) => m.list_id === l.id).length}{" "}
                  contacts
                </p>
              </div>
              <button className="button small" onClick={() => onSelect(l.id)}>
                Open list
              </button>
              <details className="view-menu">
                <summary
                  className="button small"
                  aria-label={`Options for ${l.name}`}
                >
                  More
                </summary>
                <div className="view-options">
                  <button
                    className="view-option danger"
                    aria-label={`Delete ${l.name}`}
                    onClick={() =>
                      mutate({ action: "deleteList", id: l.id }).catch((e) =>
                        setError(e.message),
                      )
                    }
                  >
                    <Trash2 size={13} /> Delete list
                  </button>
                </div>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Create a list to group your contacts." />
      )}
    </>
  );
}
export function MailScreen({
  w,
  onCompose,
}: {
  w: Workspace;
  onCompose: () => void;
}) {
  const [email, setEmail] = useState<Workspace["sent"][number] | null>(null);
  const [page, setPage] = useState(1);
  const [mail, setMail] = useState<{ items: Workspace["sent"]; total: number }>(
    { items: w.sent, total: w.sent.length },
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request<typeof mail>(`/api/mail?page=${page}`, {
      signal: controller.signal,
    })
      .then(setMail)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [page, w]);
  return (
    <>
      <Heading
        title="Mail"
        description="Compose a message or revisit recent MusicMail activity."
      >
        <button className="button primary" onClick={onCompose}>
          <Plus size={14} />
          Compose email
        </button>
      </Heading>
      {!w.gmailEmail && (
        <p className="setup-prompt">
          {w.demo
            ? "Demo mode: preview messages without sending."
            : "Connect Gmail to send from your own address."}{" "}
          <Link href="/settings">Email settings →</Link>
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {mail.items.length ? (
        <section className="panel">
          {mail.items.map((e) => (
            <div className="list-row" key={e.id}>
              <Mail size={17} />
              <div className="list-row-main">
                <button className="entity-name" onClick={() => setEmail(e)}>
                  {e.subject}
                </button>
                <p>To {e.recipient}</p>
              </div>
              <small>{new Date(e.sent_at).toLocaleDateString("en-GB")}</small>
            </div>
          ))}
        </section>
      ) : (
        <Empty title="No messages sent through MusicMail yet." />
      )}
      {mail.total > 20 && (
        <div className="pagination" style={{ marginTop: 20 }}>
          <button
            className="button small"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {page} of {Math.ceil(mail.total / 20)}
          </span>
          <button
            className="button small"
            disabled={page * 20 >= mail.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      <Dialog
        open={!!email}
        onOpenChange={(v) => !v && setEmail(null)}
        title={email?.subject || "Sent email"}
        description={`To ${email?.recipient || ""}`}
      >
        <div className="preview-message">{email?.body}</div>
      </Dialog>
    </>
  );
}
export function Templates({
  w,
  mutate,
}: {
  w: Workspace;
  mutate: (a: Action) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <Heading
        title="Templates"
        description="Starting points for a personal message."
      >
        <button
          className="button primary"
          onClick={() =>
            setEditing({ name: "", category: "Custom", subject: "", body: "" })
          }
        >
          <Plus size={14} />
          New template
        </button>
      </Heading>
      <div className="template-list">
        {w.templates.map((t) => (
          <article className="panel" key={t.id}>
            <span className="muted">{t.category}</span>
            <h3 style={{ marginTop: 15 }}>{t.name}</h3>
            <p>{t.subject}</p>
            <button className="button small" onClick={() => setEditing(t)}>
              Edit template <ArrowUpRight size={13} />
            </button>
          </article>
        ))}
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title="Make it sound like you."
        description="Use {{first_name}}, {{organisation}}, {{artist_name}} or {{contact_name}}."
      >
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {editing && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await mutate({
                  action: "template",
                  id: editing.id,
                  template: {
                    name: editing.name || "",
                    category: editing.category || "Custom",
                    subject: editing.subject || "",
                    body: editing.body || "",
                  },
                });
                setEditing(null);
                setError("");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            {(["name", "category", "subject"] as const).map((f) => (
              <label key={f} className="field">
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <input
                  value={editing[f]}
                  required
                  onChange={(e) =>
                    setEditing({ ...editing, [f]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="field">
              Message
              <textarea
                rows={9}
                value={editing.body}
                required
                onChange={(e) =>
                  setEditing({ ...editing, body: e.target.value })
                }
              />
            </label>
            <div className="form-footer">
              {editing.id ? (
                <button
                  type="button"
                  className="button danger"
                  onClick={async () => {
                    try {
                      await mutate({
                        action: "deleteTemplate",
                        id: editing.id!,
                      });
                      setEditing(null);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Delete template
                </button>
              ) : (
                <span />
              )}
              <button className="button primary">Save template</button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
export function Settings({
  w,
  refresh,
}: {
  w: Workspace;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  return (
    <>
      <Heading
        title="Settings"
        description="Manage your project, your email and your data."
      />
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="settings-stack">
        <section className="panel">
          <h3>Account</h3>
          <p>{w.email}</p>
          <form
            key={w.profile?.display_name || "new-profile"}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await updateWorkspace({
                  action: "profile",
                  display_name: String(f.get("display_name")),
                  timezone: String(f.get("timezone")),
                  country: String(f.get("country")),
                });
                await refresh();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <div className="field-grid">
              <label className="field">
                Your name
                <input
                  name="display_name"
                  defaultValue={w.profile?.display_name || ""}
                  maxLength={100}
                  required
                />
              </label>
              <label className="field">
                Timezone
                <input
                  name="timezone"
                  defaultValue={w.profile?.timezone || "Europe/London"}
                  list="timezones"
                  required
                />
                <datalist id="timezones">
                  {[
                    "Europe/London",
                    "Europe/Paris",
                    "Europe/Berlin",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Australia/Sydney",
                    "UTC",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </datalist>
              </label>
              <label className="field">
                Country
                <input
                  name="country"
                  defaultValue={w.profile?.country || ""}
                  maxLength={80}
                />
              </label>
            </div>
            <button className="button small">Save account details</button>
          </form>
          <button
            className="button"
            onClick={async () => {
              try {
                const r = await request<{ url: string }>("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "logout" }),
                });
                window.location.href = r.url;
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={13} />
            Log out
          </button>
        </section>
        <section className="panel settings-row">
          <div>
            <h3>Artist Profile</h3>
            <p>
              {w.artistName} · {w.email}
            </p>
          </div>
          <Link className="button" href="/onboarding">
            Edit artist profile
          </Link>
        </section>
        <section className="panel settings-row">
          <div>
            <h3>Email</h3>
            <p>
              {w.gmailEmail
                ? `Connected as ${w.gmailEmail}`
                : w.demo
                  ? "Demo mode · preview emails without sending."
                  : "Connect your own Gmail to send personal outreach."}
            </p>
            <p className="tiny">Send-only access. Your inbox stays in Gmail.</p>
          </div>
          {w.gmailEmail ? (
            <button
              className="button"
              onClick={async () => {
                try {
                  const result = await request<{ warning?: string }>(
                    "/api/gmail/disconnect",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: "{}",
                    },
                  );
                  await refresh();
                  if (result.warning) setError(result.warning);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Disconnect Gmail
            </button>
          ) : (
            <a
              className="button primary"
              href={w.demo ? undefined : "/api/gmail/connect"}
              aria-disabled={w.demo}
              onClick={(e) => {
                if (w.demo) {
                  e.preventDefault();
                  setError(
                    "Gmail is disabled in demo mode. Configure Supabase and Google OAuth to enable live sends.",
                  );
                }
              }}
            >
              Connect Gmail
            </a>
          )}
        </section>
        <section className="panel">
          <h3>Data</h3>
          <p>
            Export your contacts or your complete private workspace, including
            notes, lists, templates and email history.
          </p>
          <div className="actions">
            <a className="button" href="/api/export" download>
              <Download size={14} />
              Contacts CSV
            </a>
            <a className="button" href="/api/export?format=json" download>
              <Download size={14} />
              Account JSON
            </a>
          </div>
          <details className="disclosure">
            <summary>
              {w.demo ? "Reset demo workspace" : "Delete your account"}
            </summary>
            <div>
              <p>This permanently removes your private workspace data.</p>
            </div>
            <button className="button danger" onClick={() => setDeleting(true)}>
              Delete data
            </button>
          </details>
        </section>
      </div>
      <Dialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete your workspace?"
        description="This cannot be undone. Download an export first if you want to keep your data."
      >
        <label className="field">
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button
          className="button danger"
          disabled={confirmation !== "DELETE"}
          onClick={async () => {
            try {
              await request("/api/account", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation }),
              });
              window.location.replace(
                new URL("/", window.location.origin).toString(),
              );
            } catch (e) {
              setError((e as Error).message);
              setDeleting(false);
            }
          }}
        >
          Permanently delete
        </button>
      </Dialog>
    </>
  );
}
export function NewContact({
  open,
  onClose,
  mutate,
}: {
  open: boolean;
  onClose: () => void;
  mutate: (a: Action) => Promise<void>;
}) {
  const [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="A new connection."
      description="A private contact, visible only to you."
    >
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await mutate({
              action: "private",
              contact: {
                name: String(f.get("name")),
                email: String(f.get("email")),
                organisation: String(f.get("organisation")),
                role: String(f.get("role")),
                location: String(f.get("location")),
                genres: "",
                notes: String(f.get("notes")),
                relationship: "unknown",
              },
            });
            onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="field-grid">
          {["name", "email", "organisation", "role", "location"].map((f) => (
            <label className="field" key={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "name" ? " *" : ""}
              <input
                name={f}
                required={f === "name"}
                type={f === "email" ? "email" : "text"}
              />
            </label>
          ))}
        </div>
        <label className="field">
          A little context
          <textarea
            name="notes"
            placeholder="Where you met, what you talked about…"
          />
        </label>
        <button className="button primary">Add private contact</button>
      </form>
    </Dialog>
  );
}
export function RecipientPicker({
  open,
  onClose,
  w,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  w: Workspace;
  onSelect: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Contact[]; total: number }>({
    items: [],
    total: 0,
  });
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        request<typeof data>(
          `/api/network?filters=${encodeURIComponent(JSON.stringify({ q, page }))}`,
          { signal: controller.signal },
        )
          .then(setData)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          }),
      120,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, page]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Who’s on your mind?"
      description="Choose up to 10 contacts. Every recipient gets a separate message."
    >
      <label className="field">
        Find a contact
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search your network…"
        />
      </label>
      {error && <div className="error-banner">{error}</div>}
      {data.items.map((c) => (
        <label className="check-label" key={c.id}>
          <input
            type="checkbox"
            className="check"
            disabled={
              !contactEmail(c) || c.outreach_status === "do_not_contact"
            }
            checked={selected.includes(c.id)}
            onChange={(e) =>
              setSelected((s) =>
                e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id),
              )
            }
          />
          {contactName(c)}{" "}
          {c.outreach_status === "do_not_contact" ? "· Do not contact" : ""}
        </label>
      ))}
      {!w.contactCount && (
        <p className="muted">Add contacts to My Network before composing.</p>
      )}
      {data.total > 12 && (
        <div className="pagination" style={{ margin: "15px 0" }}>
          <button
            className="button small"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="muted">Page {page}</span>
          <button
            className="button small"
            disabled={page * 12 >= data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      <button
        className="button primary"
        disabled={!selected.length || selected.length > 10}
        onClick={() => onSelect(selected)}
      >
        Continue with {selected.length} contacts
      </button>
    </Dialog>
  );
}
