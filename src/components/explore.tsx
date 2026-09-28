"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Music2,
  Building2,
  Users,
  Disc3,
  Radio,
  Tent,
  ArrowUpDown,
} from "lucide-react";
import { request } from "@/lib/client";
import { label, type Entity, type Filters, type Workspace } from "@/lib/domain";
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
}: {
  workspace: Workspace;
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (e: Entity) => void;
  onAdd: (e: Entity) => Promise<void>;
  onSave: () => void;
  onError: (s: string) => void;
}) {
  const [data, setData] = useState<{ items: Entity[]; total: number }>({
    items: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("All contacts");
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
  const tabs = [
    ["All contacts", Users],
    ["Promoters", Music2],
    ["Venues", Building2],
    ["Labels", Disc3],
    ["Press & radio", Radio],
    ["Festivals", Tent],
  ] as const;
  function choose(name: string) {
    setTab(name);
    setFilters({
      ...filters,
      page: 1,
      types: name === "Venues" ? ["venue"] : [],
      roles: name === "Promoters" ? ["Promoter"] : [],
      organisationTypes:
        name === "Labels"
          ? ["Record label"]
          : name === "Press & radio"
            ? ["Publication", "Radio station"]
            : name === "Festivals"
              ? ["Festival"]
              : [],
    });
  }
  return (
    <>
      <Heading
        eyebrow="Good music starts with a connection"
        title="Find your people."
        description="Discover the people and places that could be part of your next chapter."
      >
        <Link className="button" href="/network">
          My Network <ArrowUpRight size={14} />
        </Link>
      </Heading>
      <div className="hero-panel">
        <div>
          <div className="eyebrow">A world of possibility</div>
          <h2>Your sound. The right ears.</h2>
          <p>
            From the venue down the road to the label you’ve always loved.
            <br />
            Find a little common ground. Start something good.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit" />
          <div className="orbit" />
          <div className="orbit" />
          <div className="orbit">
            <Music2 size={39} strokeWidth={1} />
          </div>
          <span className="art-star">✧</span>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([name, Icon]) => (
          <button
            key={name}
            className={`tab ${tab === name ? "active" : ""}`}
            onClick={() => choose(name)}
          >
            <Icon size={14} />
            {name}
          </button>
        ))}
      </div>
      <FilterBar filters={filters} setFilters={setFilters} onSave={onSave} />
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Genres</th>
                <th className="optional-col">The feeling</th>
                <th>Submissions</th>
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
                          {e.capacity ? ` · ${e.capacity} capacity` : ""}
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
                  <td>
                    <Tags values={e.genres.slice(0, 2)} />
                  </td>
                  <td className="optional-col">
                    <Tags values={e.emotions.slice(0, 2)} emotion />
                  </td>
                  <td>
                    <span
                      className={`tag ${e.submission_status === "open" ? "open" : ""}`}
                    >
                      {e.submission_status === "open"
                        ? "↗ Open"
                        : e.submission_status === "closed"
                          ? "— Closed"
                          : "Unknown"}
                    </span>
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
        <Empty
          title="Your people are out there."
          description="Try a broader genre, another city or fewer filters to discover more connections."
        />
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
      <div className="bottom-note">
        <Leaf size={12} />
        {workspace.demo
          ? "A safe space to explore. All demo contacts are fictional."
          : "Built for meaningful connections. Always make it personal."}
      </div>
    </>
  );
}
