"use client";
import { useState } from "react";
import { Search, SlidersHorizontal, X, Bookmark } from "lucide-react";
import { useTaxonomies } from "@/hooks/use-taxonomies";
import {
  emptyFilters,
  label,
  type Workspace,
  type Filters,
} from "@/lib/domain";
export function FilterBar({
  filters,
  setFilters,
  network = false,
  onSave,
  views,
  onView,
  children,
  lists = [],
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  network?: boolean;
  onSave: () => void;
  views: Workspace["views"];
  onView: (f: Filters, target?: string, columns?: string[]) => void;
  children?: React.ReactNode;
  lists?: Workspace["lists"];
}) {
  const {
    cities,
    genres,
    emotions,
    roles: roleNames,
    organisationTypes: orgTypes,
  } = useTaxonomies();
  const [more, setMore] = useState(false);
  const set = (patch: Partial<Filters>) =>
    setFilters({ ...filters, ...patch, page: 1 });
  const dropdown = (
    key: "roles" | "locations" | "genres" | "emotions" | "organisationTypes",
    name: string,
    options: string[],
  ) => (
    <select
      aria-label={name}
      className={`filter-select ${filters[key].length ? "selected" : ""}`}
      value=""
      onChange={(e) => {
        if (e.target.value && !filters[key].includes(e.target.value))
          set({ [key]: [...filters[key], e.target.value] });
      }}
    >
      <option value="">{name} ＋</option>
      {options.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <div className="search-row">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Search the music industry"
            placeholder={
              network
                ? "Search your network..."
                : "Search the music industry..."
            }
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
        <details className="view-menu">
          <summary className="button">
            <Bookmark size={14} /> Views
          </summary>
          <div className="view-options">
            {views
              .filter((v) => v.scope === (network ? "network" : "explore"))
              .map((v) => (
                <button
                  key={v.id}
                  className="view-option"
                  onClick={(ev) => {
                    onView(v.filter_definition, v.scope, v.visible_columns);
                    ev.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                >
                  {v.name}
                </button>
              ))}
            <button
              className="view-option"
              onClick={(ev) => {
                ev.currentTarget.closest("details")?.removeAttribute("open");
                onSave();
              }}
            >
              Save view
            </button>
          </div>
        </details>
      </div>
      <div className="filter-row">
        {dropdown("roles", "Role", roleNames)}
        {dropdown("locations", "Location", cities)}
        {dropdown("genres", "Genre", genres)}
        {dropdown("emotions", "Emotion", emotions)}
        <button
          className="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          aria-controls="advanced-filters"
        >
          <SlidersHorizontal size={14} /> More filters
        </button>
      </div>
      {more && (
        <div className="column-menu advanced-filters" id="advanced-filters">
          {dropdown("organisationTypes", "Organisation", orgTypes)}
          <select
            className="filter-select"
            aria-label="Submissions"
            value={filters.submission}
            onChange={(e) =>
              set({ submission: e.target.value as Filters["submission"] })
            }
          >
            <option value="">Submissions</option>
            <option value="open">Open submissions</option>
            <option value="closed">Closed</option>
            <option value="unknown">Unknown</option>
          </select>
          <label>
            <input
              className="check"
              type="checkbox"
              checked={filters.email}
              onChange={(e) => set({ email: e.target.checked })}
            />{" "}
            Email available
          </label>
          <label>
            <input
              className="check"
              type="checkbox"
              checked={filters.verified}
              onChange={(e) => set({ verified: e.target.checked })}
            />{" "}
            Verified only
          </label>
          <select
            className="filter-select"
            aria-label="Entity type"
            value={filters.types[0] || ""}
            onChange={(e) =>
              set({
                types: e.target.value
                  ? [e.target.value as Filters["types"][number]]
                  : [],
              })
            }
          >
            <option value="">All entity types</option>
            {["person", "organisation", "artist_project", "venue"].map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            aria-label="Submission type"
            value={filters.submissionType}
            onChange={(e) => set({ submissionType: e.target.value })}
          >
            <option value="">All submission types</option>
            {[
              "demo",
              "booking",
              "festival",
              "press",
              "radio",
              "playlist",
              "management",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            className="text-input"
            aria-label="Exclude terms"
            placeholder="Exclude terms, separated by commas"
            value={filters.exclude.join(",")}
            onChange={(e) =>
              set({ exclude: e.target.value.split(",").filter(Boolean) })
            }
          />
          {children}
          {network && (
            <>
              <select
                className="filter-select"
                aria-label="Last contacted filter"
                value={filters.lastContact}
                onChange={(e) =>
                  set({ lastContact: e.target.value as Filters["lastContact"] })
                }
              >
                <option value="">Any last contact</option>
                <option value="never">Never contacted</option>
                <option value="recent">Contacted in last 30 days</option>
                <option value="older">More than 30 days ago</option>
              </select>
              <select
                className="filter-select"
                aria-label="Priority filter"
                value={filters.priority}
                onChange={(e) => set({ priority: e.target.value })}
              >
                <option value="">Any priority</option>
                {["high", "medium", "low"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                className="filter-select"
                aria-label="Follow-up filter"
                value={filters.followUp}
                onChange={(e) =>
                  set({ followUp: e.target.value as Filters["followUp"] })
                }
              >
                <option value="">Any follow-up</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </>
          )}
        </div>
      )}
      <div className="filter-row">
        {(
          [
            "roles",
            "locations",
            "genres",
            "emotions",
            "organisationTypes",
            "types",
            "exclude",
          ] as const
        ).flatMap((key) =>
          filters[key].map((v) => (
            <button
              className="filter-chip"
              key={key + v}
              onClick={() =>
                set({ [key]: filters[key].filter((x) => x !== v) })
              }
            >
              {label(v)}
              <X size={10} />
            </button>
          )),
        )}
        {(
          [
            "submission",
            "submissionType",
            "relationship",
            "outreach",
            "priority",
            "lastContact",
            "followUp",
          ] as const
        )
          .filter((key) => filters[key])
          .map((key) => (
            <button
              className="filter-chip"
              key={key}
              aria-label={`Remove ${label(key)} filter`}
              onClick={() => set({ [key]: "" })}
            >
              {label(filters[key])}
              <X size={10} />
            </button>
          ))}
        {(["email", "verified"] as const)
          .filter((key) => filters[key])
          .map((key) => (
            <button
              className="filter-chip"
              key={key}
              onClick={() => set({ [key]: false })}
            >
              {key === "email" ? "Email available" : "Verified"}
              <X size={10} />
            </button>
          ))}
        {filters.list && (
          <button
            className="filter-chip"
            onClick={() => set({ list: "" })}
            aria-label="Remove list filter"
          >
            {lists.find((l) => l.id === filters.list)?.name || "List"}
            <X size={10} />
          </button>
        )}
        {JSON.stringify(filters) !== JSON.stringify(emptyFilters) && (
          <button
            className="clear-filters"
            onClick={() => setFilters(emptyFilters)}
          >
            Clear filters
          </button>
        )}
      </div>
    </>
  );
}
