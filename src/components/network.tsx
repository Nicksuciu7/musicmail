"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { request } from "@/lib/client";
import { Plus, Upload, Download, Mail, Columns3, MapPin } from "lucide-react";
import {
  contactName,
  relationships,
  outreachStates,
  label,
  type Workspace,
  type Filters,
  type Contact,
  type Action,
} from "@/lib/domain";
import { Heading, Avatar, Tags, Empty } from "./common";
import { FilterBar } from "./filters";
export function Network({
  workspace,
  filters,
  setFilters,
  onOpen,
  onNew,
  onImport,
  onSave,
  onEmail,
  mutate,
}: {
  workspace: Workspace;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (c: Contact) => void;
  onNew: () => void;
  onImport: () => void;
  onSave: (columns?: string[]) => void;
  onEmail: (ids: string[]) => void;
  mutate: (a: Action) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [columns, setColumns] = useState([
    "location",
    "genres",
    "relationship",
    "outreach",
    "followup",
  ]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("musicmail-network-columns");
      if (raw) {
        const values = JSON.parse(raw);
        if (
          Array.isArray(values) &&
          values.every((v) =>
            [
              "location",
              "genres",
              "relationship",
              "outreach",
              "followup",
              "priority",
              "last_contact",
            ].includes(v),
          )
        )
          setColumns(values);
      }
    } catch {}
  }, []);
  const saveColumns = (next: string[]) => {
    setColumns(next);
    localStorage.setItem("musicmail-network-columns", JSON.stringify(next));
  };
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ items: Contact[]; total: number }>({
    items: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      request<{ items: Contact[]; total: number }>(
        `/api/network?filters=${encodeURIComponent(JSON.stringify(filters))}`,
        { signal: controller.signal },
      )
        .then(setResults)
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, workspace]);
  const page = results.items;
  const total = results.total;
  const act = (a: Action) => mutate(a).catch((e) => setError(e.message));
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  return (
    <>
      <Heading
        eyebrow="Good relationships, thoughtfully kept"
        title="My Network"
        description="The people you know. The connections you’re growing."
      >
        <div className="actions">
          <button className="button" onClick={onImport}>
            <Upload size={14} />
            Import CSV
          </button>
          <button className="button primary" onClick={onNew}>
            <Plus size={14} />
            Add contact
          </button>
        </div>
      </Heading>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        network
        onSave={() => onSave(columns)}
      />
      <div className="filter-row">
        <select
          className="filter-select"
          aria-label="Relationship filter"
          value={filters.relationship}
          onChange={(e) =>
            setFilters({ ...filters, relationship: e.target.value, page: 1 })
          }
        >
          <option value="">All relationships</option>
          {relationships.map((v) => (
            <option key={v} value={v}>
              {label(v)}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Outreach filter"
          value={filters.outreach}
          onChange={(e) =>
            setFilters({ ...filters, outreach: e.target.value, page: 1 })
          }
        >
          <option value="">All outreach</option>
          {outreachStates.map((v) => (
            <option key={v} value={v}>
              {label(v)}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="List filter"
          value={filters.list}
          onChange={(e) =>
            setFilters({ ...filters, list: e.target.value, page: 1 })
          }
        >
          <option value="">All lists</option>
          {workspace.lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="result-meta">
        <span>
          <strong>{total} contacts</strong> · Only visible to you
        </span>
        <div className="actions">
          <button
            className="clear-filters"
            onClick={() => setShowColumns(!showColumns)}
          >
            <Columns3 size={12} style={{ display: "inline" }} /> Columns
          </button>
          <a className="clear-filters" href="/api/export" download>
            <Download size={12} style={{ display: "inline" }} /> Export CSV
          </a>
        </div>
      </div>
      {showColumns && (
        <div className="column-menu">
          {[
            "location",
            "genres",
            "relationship",
            "outreach",
            "followup",
            "priority",
            "last_contact",
          ].map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                className="check"
                checked={columns.includes(c)}
                onChange={() =>
                  saveColumns(
                    columns.includes(c)
                      ? columns.filter((x) => x !== c)
                      : [...columns, c],
                  )
                }
              />{" "}
              {label(c)}
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong>{selected.length} selected</strong>
          <button
            className="button small"
            disabled={selected.length > 10}
            onClick={() => onEmail(selected)}
          >
            <Mail size={12} />
            Email selected
          </button>
          <select
            className="filter-select"
            aria-label="Add selected to list"
            value=""
            onChange={(e) =>
              e.target.value &&
              act({
                action: "member",
                listId: e.target.value,
                contactIds: selected,
                remove: false,
              })
            }
          >
            <option value="">Add to list…</option>
            {workspace.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button className="clear-filters" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}
      {loading ? (
        <div aria-busy="true" aria-label="Loading contacts">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : total ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      className="check"
                      type="checkbox"
                      aria-label="Select page"
                      checked={
                        page.length > 0 &&
                        page.every((c) => selected.includes(c.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [
                                ...new Set([
                                  ...selected,
                                  ...page.map((c) => c.id),
                                ]),
                              ]
                            : selected.filter(
                                (id) => !page.some((c) => c.id === id),
                              ),
                        )
                      }
                    />
                  </th>
                  <th>
                    <button
                      className="clear-filters"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          sort: filters.sort === "name" ? "recent" : "name",
                        })
                      }
                    >
                      Name ↕
                    </button>
                  </th>
                  {columns.map((c) => (
                    <th key={c}>{label(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.map((c, i) => (
                  <tr key={c.id}>
                    <td>
                      <input
                        className="check"
                        type="checkbox"
                        aria-label={`Select ${contactName(c)}`}
                        checked={selected.includes(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="name-td">
                      <div className="entity-cell">
                        <Avatar name={contactName(c)} index={i} />
                        <div>
                          <button
                            className="entity-name"
                            onClick={() => onOpen(c)}
                          >
                            {contactName(c)}
                          </button>
                          <div className="entity-sub">
                            {c.entity?.organisation_type ||
                              c.entity?.roles[0] ||
                              c.private_details.role ||
                              "Private contact"}
                          </div>
                        </div>
                      </div>
                    </td>
                    {columns.map((col) => (
                      <td key={col}>
                        {col === "location" ? (
                          <span className="location">
                            <MapPin size={11} />
                            {c.entity?.location ||
                              c.private_details.location ||
                              "—"}
                          </span>
                        ) : col === "genres" ? (
                          <Tags
                            values={
                              c.entity?.genres.slice(0, 1) ||
                              (c.private_details.genres
                                ? [c.private_details.genres]
                                : [])
                            }
                          />
                        ) : col === "relationship" || col === "outreach" ? (
                          <select
                            aria-label={`${label(col)} for ${contactName(c)}`}
                            className="inline-select"
                            value={
                              col === "relationship"
                                ? c.relationship_status
                                : c.outreach_status
                            }
                            onChange={(e) =>
                              act({
                                action: "update",
                                id: c.id,
                                patch:
                                  col === "relationship"
                                    ? {
                                        relationship_status: e.target
                                          .value as Contact["relationship_status"],
                                      }
                                    : {
                                        outreach_status: e.target
                                          .value as Contact["outreach_status"],
                                      },
                              })
                            }
                          >
                            {(col === "relationship"
                              ? relationships
                              : outreachStates
                            ).map((v) => (
                              <option key={v} value={v}>
                                {label(v)}
                              </option>
                            ))}
                          </select>
                        ) : col === "followup" ? (
                          <input
                            className="inline-select"
                            aria-label={`Follow-up for ${contactName(c)}`}
                            type="date"
                            value={c.follow_up_at || ""}
                            onChange={(e) =>
                              act({
                                action: "update",
                                id: c.id,
                                patch: { follow_up_at: e.target.value || null },
                              })
                            }
                          />
                        ) : col === "priority" ? (
                          <span className="tag">{c.priority || "—"}</span>
                        ) : c.last_contacted_at ? (
                          new Date(c.last_contacted_at).toLocaleDateString(
                            "en-GB",
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>
              Showing {page.length} of {total} contacts
            </span>
            <div className="pagination">
              <button
                className="button small"
                disabled={filters.page === 1}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
              >
                Previous
              </button>
              <span>{filters.page}</span>
              <button
                className="button small"
                disabled={filters.page * 12 >= total}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title="Every connection starts somewhere."
          description="Find your people in Explore, import your spreadsheet, or add someone you’ve met along the way."
        >
          <Link className="button primary" href="/explore">
            Explore the directory →
          </Link>
        </Empty>
      )}
    </>
  );
}
