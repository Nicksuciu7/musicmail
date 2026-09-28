"use client";
import { useState } from "react";
import { AdminRecords } from "./admin-records";
import { Heading, Empty } from "./common";
import { request } from "@/lib/client";
import type { Entity } from "@/lib/domain";
const blank = {
  entity_type: "organisation",
  display_name: "",
  description: "",
  location: "London",
  organisation_type: "",
  roles: [],
  genres: [],
  emotions: [],
  aliases: [],
  email: "",
  verification_status: "unverified",
  submission_type: "general",
  submission_status: "unknown",
  submission_instructions: "",
  source: "",
  source_url: "",
};
export function Admin({ enabled }: { enabled: boolean }) {
  const [json, setJson] = useState(JSON.stringify(blank, null, 2));
  const [id, setId] = useState("");
  const [target, setTarget] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [table, setTable] = useState("genres");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const send = async (input: unknown) => {
    try {
      await request("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setMessage("Saved successfully.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  if (!enabled)
    return (
      <Empty
        title="Internal database tools."
        description="Sign in with an administrator account to maintain the shared directory. Demo users cannot change shared records."
      />
    );
  return (
    <>
      <Heading
        eyebrow="Internal tools"
        title="Look after the directory."
        description="Edit verified facts, maintain provenance and confirm duplicate merges."
      />
      {message && (
        <div className="source-box" role="status">
          {message}
        </div>
      )}
      <div className="settings-stack">
        <AdminRecords />
        <section className="panel">
          <h3>Create or edit an entity</h3>
          <p>
            Use canonical names for location and taxonomies. JSON editing keeps
            the internal V1 interface small.
          </p>
          <div className="search-row">
            <input
              className="text-input"
              placeholder="Entity UUID"
              aria-label="Entity UUID"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
            <button
              className="button"
              onClick={async () => {
                try {
                  const r = await request<Entity>(`/api/admin/entity?id=${id}`);
                  setJson(JSON.stringify(r, null, 2));
                } catch (e) {
                  setMessage((e as Error).message);
                }
              }}
            >
              Load
            </button>
          </div>
          <label className="field">
            Entity document
            <textarea
              rows={20}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </label>
          <div className="actions">
            <button
              className="button primary"
              onClick={() => {
                try {
                  void send({ action: "save", document: JSON.parse(json) });
                } catch {
                  setMessage("Invalid JSON.");
                }
              }}
            >
              Validate & save
            </button>
            <button
              className="button danger"
              disabled={!id}
              onClick={() => send({ action: "archive", id })}
            >
              Archive loaded entity
            </button>
          </div>
        </section>
        <section className="panel">
          <h3>Canonical taxonomies</h3>
          <label className="field">
            Taxonomy
            <select value={table} onChange={(e) => setTable(e.target.value)}>
              {["genres", "emotions", "roles", "organisation_types"].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </label>
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="button"
            onClick={() => send({ action: "taxonomy", table, name })}
          >
            Add taxonomy value
          </button>
        </section>
        <section className="panel">
          <h3>Merge confirmed duplicates</h3>
          <p>
            The loaded entity becomes an archived alias of the target. Private
            histories remain owner-scoped. Conflicting private overlays are
            retained as archived contacts.
          </p>
          <label className="field">
            Source UUID
            <input value={id} onChange={(e) => setId(e.target.value)} />
          </label>
          <label className="field">
            Target UUID
            <input value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I verified these are the same real-world entity.
          </label>
          <button
            className="button danger"
            disabled={!confirmed || !id || !target}
            onClick={() =>
              send({ action: "merge", source: id, target, confirmed: true })
            }
          >
            Merge duplicates
          </button>
        </section>
      </div>
    </>
  );
}
