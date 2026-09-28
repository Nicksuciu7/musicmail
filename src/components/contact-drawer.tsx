"use client";
import { useState } from "react";
import {
  Mail,
  MapPin,
  Plus,
  LockKeyhole,
  Archive,
  ExternalLink,
} from "lucide-react";
import {
  contactName,
  contactEmail,
  relationships,
  outreachStates,
  label,
  type Contact,
  type Entity,
  type Action,
  type Workspace,
} from "@/lib/domain";
import { Dialog } from "./ui/dialog";
import { Avatar, Tags } from "./common";
export function ContactDrawer({
  entity,
  contact,
  workspace,
  onClose,
  mutate,
  onEmail,
}: {
  entity?: Entity | null;
  contact?: Contact | null;
  workspace: Workspace;
  onClose: () => void;
  mutate: (a: Action) => Promise<void>;
  onEmail: (ids: string[]) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const e = entity || contact?.entity;
  const name = e?.display_name || (contact ? contactName(contact) : "");
  const save = async (a: Action) => {
    setError("");
    setBusy(true);
    try {
      await mutate(a);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = (patch: Extract<Action, { action: "update" }>["patch"]) =>
    contact && save({ action: "update", id: contact.id, patch });
  return (
    <Dialog
      open={!!(entity || contact)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={name}
      description={
        e?.organisation_type || e?.roles.join(" · ") || "Private contact"
      }
      drawer
    >
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <Avatar name={name} />
        <span className="location">
          <MapPin size={13} />
          {e?.location ||
            contact?.private_details.location ||
            "Location not added"}
        </span>
        <span className={`tag ${contact ? "private" : ""}`}>
          {contact ? "In your network" : "Shared directory"}
        </span>
      </div>
      <p className="drawer-description">
        {e?.description ||
          "Only you can see this contact and the details you add."}
      </p>
      {contact && !e && (
        <div className="field-grid" style={{ marginTop: 20 }}>
          <label className="field">
            Contact name
            <input
              defaultValue={contact.private_display_name || ""}
              key={contact.id + "name"}
              onBlur={(ev) => {
                if (ev.target.value !== contact.private_display_name)
                  update({ private_display_name: ev.target.value });
              }}
            />
          </label>
          <label className="field">
            Contact email
            <input
              type="email"
              defaultValue={contact.private_email || ""}
              key={contact.id + "email"}
              onBlur={(ev) => {
                if (ev.target.value !== contact.private_email)
                  update({ private_email: ev.target.value });
              }}
            />
          </label>
        </div>
      )}
      {(e?.organisation || contact?.private_details.organisation) && (
        <div className="detail-line">
          Organisation:{" "}
          {e?.organisation || contact?.private_details.organisation}
        </div>
      )}
      <div className="section-label">The music connection</div>
      <Tags
        values={
          e?.genres ||
          (contact?.private_details.genres || "").split(";").filter(Boolean)
        }
      />
      <div style={{ marginTop: 7 }}>
        <Tags values={e?.emotions || []} emotion />
      </div>
      <hr className="drawer-rule" />
      <div className="section-label">Contact & submissions</div>
      <div className="detail-line">
        <Mail size={14} />
        {contact ? contactEmail(contact) : e?.email || "No public email listed"}
      </div>
      {e?.contact_methods
        ?.filter((m) => m.value !== e.email && m.value !== e.website)
        .map((m) => (
          <div className="detail-line" key={m.id}>
            <span>
              {m.label || label(m.contact_type)}
              {m.purpose ? ` · ${label(m.purpose)}` : ""}:{" "}
            </span>
            {/^https?:\/\//i.test(m.value) ? (
              <a href={m.value} target="_blank" rel="noreferrer">
                {m.value}
                <ExternalLink
                  size={11}
                  style={{ display: "inline", marginLeft: 5 }}
                />
              </a>
            ) : (
              <span>{m.value}</span>
            )}
          </div>
        ))}
      {e?.website && (
        <a
          className="detail-line"
          href={e.website}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} />
          Website
        </a>
      )}
      {e && (
        <>
          <span className="tag open">
            {label(e.submission_status)} {e.submission_type} submissions
          </span>
          <p className="drawer-description">{e.submission_instructions}</p>
          <div className="source-box">
            Source: {e.source || "No source provided"}
            {e.source_url && /^https?:\/\//i.test(e.source_url) && (
              <a href={e.source_url} target="_blank" rel="noreferrer">
                {" "}
                · View source ↗
              </a>
            )}
            <br />
            Status: {label(e.verification_status)}
            {e.verified_at
              ? ` · ${new Date(e.verified_at).toLocaleDateString("en-GB")}`
              : ""}
          </div>
        </>
      )}
      <div className="actions" style={{ marginTop: 20 }}>
        {contact ? (
          <button
            className="button primary"
            disabled={
              contact.outreach_status === "do_not_contact" ||
              !contactEmail(contact)
            }
            onClick={() => onEmail([contact.id])}
          >
            <Mail size={14} />
            Write an email
          </button>
        ) : (
          e && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => save({ action: "add", entityId: e.id })}
            >
              <Plus size={14} />
              Add to My Network
            </button>
          )
        )}
      </div>
      {contact && (
        <>
          <hr className="drawer-rule" />
          <div className="section-label">
            <LockKeyhole
              size={11}
              style={{ display: "inline", marginRight: 5 }}
            />
            Your private relationship
          </div>
          <div className="field-grid">
            <label className="field">
              Relationship
              <select
                aria-label="Relationship"
                value={contact.relationship_status}
                onChange={(e) =>
                  update({
                    relationship_status: e.target
                      .value as Contact["relationship_status"],
                  })
                }
              >
                {relationships.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Outreach
              <select
                aria-label="Outreach"
                value={contact.outreach_status}
                onChange={(e) =>
                  update({
                    outreach_status: e.target
                      .value as Contact["outreach_status"],
                  })
                }
              >
                {outreachStates.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Priority
              <select
                aria-label="Priority"
                value={contact.priority || ""}
                onChange={(e) =>
                  update({
                    priority: (e.target.value || null) as Contact["priority"],
                  })
                }
              >
                <option value="">No priority</option>
                {["low", "medium", "high"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Follow up on
              <input
                type="date"
                value={contact.follow_up_at || ""}
                onChange={(e) =>
                  update({ follow_up_at: e.target.value || null })
                }
              />
            </label>
          </div>
          <label className="field">
            How you met
            <input
              defaultValue={contact.relationship_origin || ""}
              key={contact.id}
              placeholder="A show, an introduction, a happy coincidence…"
              onBlur={(e) => {
                if (e.target.value !== contact.relationship_origin)
                  update({ relationship_origin: e.target.value });
              }}
            />
          </label>
          <label className="field">
            Add to a list
            <select
              value=""
              onChange={(e) =>
                e.target.value &&
                save({
                  action: "member",
                  listId: e.target.value,
                  contactIds: [contact.id],
                  remove: false,
                })
              }
            >
              <option value="">Choose a list…</option>
              {workspace.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            {workspace.members
              .filter((m) => m.user_contact_id === contact.id)
              .map((m) => (
                <button
                  className="filter-chip"
                  key={m.list_id}
                  onClick={() =>
                    save({
                      action: "member",
                      listId: m.list_id,
                      contactIds: [contact.id],
                      remove: true,
                    })
                  }
                  aria-label={`Remove from ${workspace.lists.find((l) => l.id === m.list_id)?.name}`}
                >
                  {workspace.lists.find((l) => l.id === m.list_id)?.name} ×
                </button>
              ))}
          </div>
          <div className="section-label">Private notes</div>
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              try {
                await mutate({ action: "note", id: contact.id, body: note });
                setNote("");
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label className="field">
              <span className="sr-only">Private note</span>
              <textarea
                aria-label="Private note"
                placeholder="A little context goes a long way…"
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                required
                maxLength={20000}
              />
            </label>
            <button className="button small" disabled={!note.trim() || busy}>
              Save note
            </button>
          </form>
          {workspace.notes
            .filter((n) => n.user_contact_id === contact.id)
            .map((n) => (
              <div className="note-card" key={n.id}>
                <p style={{ margin: 0 }}>{n.body}</p>
                <span className="note-date">
                  {new Date(n.created_at).toLocaleDateString("en-GB")}
                </span>
              </div>
            ))}
          <div className="section-label">Your history</div>
          {workspace.interactions
            .filter((i) => i.user_contact_id === contact.id)
            .slice(0, 20)
            .map((i) => (
              <div className="timeline-item" key={i.id}>
                {i.title}
                <small>{new Date(i.occurred_at).toLocaleString("en-GB")}</small>
              </div>
            ))}
          <button
            className="button danger small"
            onClick={async () => {
              await save({
                action: "update",
                id: contact.id,
                patch: { archived: true },
              });
              onClose();
            }}
          >
            <Archive size={13} />
            Archive contact
          </button>
        </>
      )}
    </Dialog>
  );
}
