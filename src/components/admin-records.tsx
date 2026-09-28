"use client";
import { useState } from "react";
import { request } from "@/lib/client";
export function AdminRecords() {
  const [table, setTable] = useState("entity_contact_methods");
  const [entityId, setEntityId] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [json, setJson] = useState("{}");
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      setRows(
        await request<Record<string, unknown>[]>(
          `/api/admin/records?table=${table}&entityId=${entityId}`,
        ),
      );
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const mutate = async (action: string) => {
    try {
      await request("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, table, record: JSON.parse(json) }),
      });
      await load();
      setMessage("Record saved.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <section className="panel">
      <h3>Related records and taxonomy editor</h3>
      <p>
        Load existing rows to inspect their IDs and fields. Select a row, edit
        its JSON, then save. Omit id to create a new row. Deletes fail safely
        when another record references the row.
      </p>
      <label className="field">
        Table
        <select
          value={table}
          onChange={(e) => {
            setTable(e.target.value);
            setRows([]);
            setJson("{}");
          }}
        >
          {[
            "entity_contact_methods",
            "submission_channels",
            "entity_sources",
            "entity_aliases",
            "entity_roles",
            "genres",
            "emotions",
            "roles",
            "organisation_types",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Entity UUID (for entity-related tables)
        <input value={entityId} onChange={(e) => setEntityId(e.target.value)} />
      </label>
      <button className="button" onClick={load}>
        Load records
      </button>
      <div className="stack" style={{ margin: "15px 0" }}>
        {rows.map((row, i) => (
          <button
            className="button small"
            style={{ whiteSpace: "normal", textAlign: "left" }}
            key={String(row.id || i)}
            onClick={() => setJson(JSON.stringify(row, null, 2))}
          >
            {String(
              row.name ||
                row.value ||
                row.alias ||
                row.source_name ||
                row.submission_type ||
                row.id,
            )}
          </button>
        ))}
      </div>
      <label className="field">
        Record JSON
        <textarea
          rows={12}
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
      </label>
      {message && <p role="status">{message}</p>}
      <div className="actions">
        <button className="button primary" onClick={() => mutate("save")}>
          Validate & save record
        </button>
        <button className="button danger" onClick={() => mutate("delete")}>
          Delete selected record
        </button>
      </div>
    </section>
  );
}
