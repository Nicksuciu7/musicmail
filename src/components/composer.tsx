"use client";
import { useState } from "react";
import { Eye, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "./ui/dialog";
import {
  contactName,
  contactEmail,
  mergeTemplate,
  type Workspace,
} from "@/lib/domain";
import { request } from "@/lib/client";
type Message = {
  attemptId: string;
  contactId: string;
  subject: string;
  body: string;
};
export function Composer({
  ids,
  w,
  onClose,
  onSent,
}: {
  ids: string[];
  w: Workspace;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const contacts = ids.flatMap((id) => {
    const c = w.contacts.find((c) => c.id === id);
    return c ? [c] : [];
  });
  const [messages, setMessages] = useState<Message[]>(
    contacts.map((c) => ({
      attemptId: crypto.randomUUID(),
      contactId: c.id,
      subject: "",
      body: "",
    })),
  );
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(false);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<
    { contactId: string; status: string; message: string }[]
  >([]);
  const c = contacts[index],
    m = messages[index];
  const set = (patch: Partial<Message>) => {
    setMessages((ms) =>
      ms.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );
    setReviewed((r) => r.filter((id) => id !== c.id));
    setPreview(false);
    setConfirmed(false);
  };
  const choose = (id: string) => {
    const t = w.templates.find((t) => t.id === id);
    if (!t) return;
    try {
      setMessages(
        contacts.map((c) => {
          const values = {
            first_name: contactName(c).split(" ")[0],
            organisation:
              c.entity?.organisation ||
              c.entity?.display_name ||
              c.private_details.organisation ||
              "",
            artist_name: w.artistName,
            contact_name: contactName(c),
          };
          return {
            contactId: c.id,
            attemptId: crypto.randomUUID(),
            subject: mergeTemplate(t.subject, values),
            body: mergeTemplate(t.body, values),
          };
        }),
      );
      setReviewed([]);
      setPreview(false);
      setConfirmed(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Dialog
      open={true}
      onOpenChange={(v) => !v && !busy && onClose()}
      title="Make it personal."
      description={`Each contact receives their own email. ${w.gmailEmail ? `Sending as ${w.gmailEmail}` : "Preview mode · connect Gmail in Settings to send."}`}
    >
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {c && m ? (
        <>
          <div className="form-footer" style={{ margin: "0 0 20px" }}>
            <span className="muted">
              To: <strong>{contactName(c)}</strong>
              <br />
              {contactEmail(c)}
            </span>
            <div className="pagination">
              <button
                className="icon-button"
                aria-label="Previous recipient"
                disabled={index === 0}
                onClick={() => {
                  setIndex(index - 1);
                  setPreview(false);
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="muted">
                {index + 1} / {contacts.length}
              </span>
              <button
                className="icon-button"
                aria-label="Next recipient"
                disabled={index === contacts.length - 1}
                onClick={() => {
                  setIndex(index + 1);
                  setPreview(false);
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <label className="field">
            Start with a template
            <select
              aria-label="Choose email template"
              defaultValue=""
              onChange={(e) => choose(e.target.value)}
              disabled={busy || results.length > 0}
            >
              <option value="">Write from scratch…</option>
              {w.templates.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {preview ? (
            <div className="preview-message">
              <strong>{m.subject}</strong>
              <hr className="drawer-rule" />
              {m.body}
            </div>
          ) : (
            <>
              <label className="field">
                Subject
                <input
                  value={m.subject}
                  onChange={(e) => set({ subject: e.target.value })}
                  disabled={busy || results.length > 0}
                  maxLength={300}
                />
              </label>
              <label className="field">
                Your message
                <textarea
                  rows={10}
                  value={m.body}
                  onChange={(e) => set({ body: e.target.value })}
                  disabled={busy || results.length > 0}
                />
              </label>
            </>
          )}
          {c.outreach_status === "do_not_contact" && (
            <p className="error-banner">
              This contact is marked do not contact. Sending is blocked.
            </p>
          )}
          <div className="form-footer">
            <button
              className="button"
              disabled={!m.subject.trim() || !m.body.trim()}
              onClick={() => {
                setPreview(!preview);
                setReviewed((r) => [...new Set([...r, c.id])]);
              }}
            >
              <Eye size={14} />
              {preview ? "Back to editing" : "Preview message"}
            </button>
            <span className="muted">
              {reviewed.length} of {contacts.length} reviewed
            </span>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={reviewed.length !== contacts.length}
            />
            I reviewed each message and want to send {contacts.length} separate
            email{contacts.length === 1 ? "" : "s"}.
          </label>
          <button
            className="button primary"
            disabled={
              w.demo ||
              !w.gmailEmail ||
              busy ||
              results.length > 0 ||
              !confirmed ||
              reviewed.length !== contacts.length ||
              contacts.some(
                (c) =>
                  c.outreach_status === "do_not_contact" || !contactEmail(c),
              )
            }
            onClick={async () => {
              setBusy(true);
              try {
                const r = await request<{ results: typeof results }>(
                  "/api/gmail/send",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages, confirmed: true }),
                  },
                );
                setResults(r.results);
                await onSent();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send size={14} />
            {busy
              ? "Sending individually…"
              : w.demo
                ? "Demo preview · sending disabled"
                : `Send ${contacts.length === 1 ? "email" : `${contacts.length} emails`}`}
          </button>
          {results.map((r) => (
            <div
              className="source-box"
              key={r.contactId}
              style={{ marginTop: 12 }}
            >
              {contactName(contacts.find((c) => c.id === r.contactId)!)}:{" "}
              {r.message}
            </div>
          ))}
        </>
      ) : (
        <p>No available recipients.</p>
      )}
    </Dialog>
  );
}
