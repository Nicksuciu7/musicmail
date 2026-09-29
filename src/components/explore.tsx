"use client";
import { useEffect, useState } from "react";
import { MapPin, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { request } from "@/lib/client";
import {
  emptyFilters,
  label,
  type Entity,
  type Filters,
  type Workspace,
} from "@/lib/domain";
import { Heading, Avatar, Tags, Empty, AddButton } from "./common";
import { FilterBar } from "./filters";
export function Explore({
  workspace,
  filters,
  setFilters,
  onOpen,
  onAdd,
  onSave,
  onError,
  onView,
}: {
  workspace: Workspace;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (e: Entity) => void;
  onAdd: (e: Entity) => Promise<void>;
  onSave: () => void;
  onError: (s: string) => void;
  onView: (f: Filters, target?: string, columns?: string[]) => void;
}) {
  const [data, setData] = useState<{ items: Entity[]; total: number }>({
    items: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      request<{ items: Entity[]; total: number }>(
        `/api/explore?filters=${encodeURIComponent(JSON.stringify(filters))}`,
        { signal: controller.signal },
      )
        .then(setData)
        .catch((e) => {
          if (e.name !== "AbortError") onError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, onError]);
  return (
    <>
      <Heading
        title="Explore"
        description="Find the right people for your music."
      />
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onSave={onSave}
        views={workspace.views}
        onView={onView}
      />
      <div className="result-meta">
        <span>
          <strong>{data.total} connections</strong> to explore{" "}
          <span style={{ margin: "0 8px" }}>·</span>{" "}
          {workspace.demo
            ? "Fictional demo collection"
            : "The independent music community"}
        </span>
        <button
          className="clear-filters"
          onClick={() =>
            setFilters({
              ...filters,
              sort: filters.sort === "name" ? "recent" : "name",
            })
          }
        >
          <ArrowUpDown
            size={11}
            style={{ display: "inline", marginRight: 5 }}
          />
          {filters.sort === "name" ? "Name, A–Z" : "Recently added"}
        </button>
      </div>
      {loading ? (
        <div aria-label="Loading connections" aria-busy="true">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : data.items.length ? (
        <div className="table-wrap">
          <table className="data-table explore-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Music</th>
                <th aria-label="Add to network" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((e, i) => (
                <tr key={e.id}>
                  <td className="name-td">
                    <div className="entity-cell">
                      <Avatar name={e.display_name} index={i} />
                      <div>
                        <button
                          className="entity-name"
                          onClick={() => onOpen(e)}
                        >
                          {e.display_name}
                        </button>
                        <div className="entity-sub">
                          {e.organisation_type ||
                            e.roles[0] ||
                            label(e.entity_type)}
                          {e.organisation ? ` · ${e.organisation}` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="location">
                      <MapPin size={11} />
                      {e.location}
                    </span>
                  </td>
                  <td className="music-cell">
                    <Tags values={e.genres.slice(0, 2)} limit={2} />
                    <Tags values={e.emotions.slice(0, 1)} emotion limit={1} />
                    {e.genres.length + e.emotions.length >
                      Math.min(e.genres.length, 2) +
                        Math.min(e.emotions.length, 1) && (
                      <span
                        className="tag-count"
                        aria-label="More music tags in contact details"
                      >
                        +
                        {e.genres.length +
                          e.emotions.length -
                          Math.min(e.genres.length, 2) -
                          Math.min(e.emotions.length, 1)}
                      </span>
                    )}
                  </td>
                  <td className="add-td">
                    <AddButton
                      entity={e}
                      added={(workspace.networkEntityIds || []).includes(e.id)}
                      busy={busy === e.id}
                      onClick={async () => {
                        setBusy(e.id);
                        try {
                          await onAdd(e);
                        } finally {
                          setBusy("");
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No contacts match these filters.">
          <button className="button" onClick={() => setFilters(emptyFilters)}>
            Clear filters
          </button>
        </Empty>
      )}
      <div className="table-footer">
        <span>
          {data.total
            ? `Showing ${(filters.page - 1) * 12 + 1}–${Math.min(filters.page * 12, data.total)} of ${data.total} connections`
            : "No matching connections"}
        </span>
        <div className="pagination">
          <button
            className="button small"
            aria-label="Previous page"
            disabled={filters.page === 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            <ChevronLeft size={13} />
          </button>
          <span>
            Page {filters.page} of {Math.max(1, Math.ceil(data.total / 12))}
          </span>
          <button
            className="button small"
            aria-label="Next page"
            disabled={filters.page * 12 >= data.total}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
