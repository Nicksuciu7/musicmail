"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Temporal } from "@js-temporal/polyfill";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Heading, Empty } from "./common";
import { Dialog } from "./ui/dialog";
import { request } from "@/lib/client";
import { contactName, type Workspace, type Entity } from "@/lib/domain";
import {
  eventTypes,
  eventDate,
  eventLastDate,
  eventTime,
  eventToInput,
  todayIn,
  dateLabel,
  timeLabel,
  monthDays,
  normaliseEvent,
  type CalendarEvent,
  type EventInput,
} from "@/lib/calendar";
import { googleCalendarURL, eventDetails } from "@/lib/calendar-export";
const send = (data: unknown) =>
  request<{ event: CalendarEvent | null }>("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export function NextUp({ w }: { w: Workspace }) {
  const zone = w.profile?.timezone || "Europe/London",
    today = todayIn(zone);
  const events = (w.calendarEvents || [])
    .filter((e) => eventLastDate(e, zone) >= today)
    .sort(
      (a, b) =>
        eventDate(a, zone).localeCompare(eventDate(b, zone)) ||
        (a.starts_at || "").localeCompare(b.starts_at || ""),
    )
    .slice(0, 3);
  return (
    <section className="panel next-up">
      <div className="panel-header">
        <h3>Next up</h3>
        <Link href="/calendar">Calendar →</Link>
      </div>
      {events.length ? (
        events.map((e) => (
          <Link
            className="calendar-next"
            href={`/calendar?event=${e.id}`}
            key={e.id}
          >
            <strong>{e.title}</strong>
            <span>
              {dateLabel(eventDate(e, zone))} · {eventTime(e, zone)}
              {e.load_in_at
                ? ` · Load-in ${timeLabel(e.load_in_at, zone)}`
                : ""}
            </span>
          </Link>
        ))
      ) : (
        <p>
          No events yet. <Link href="/calendar">Plan your next gig →</Link>
        </p>
      )}
    </section>
  );
}
export function Calendar({ w }: { w: Workspace }) {
  const zone = w.profile?.timezone || "Europe/London",
    today = todayIn(zone);
  const [view, setView] = useState("upcoming"),
    [month, setMonth] = useState(today.slice(0, 7)),
    [rangeStart, setRangeStart] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [hasMore, setHasMore] = useState(false),
    [offset, setOffset] = useState(0),
    [opened, setOpened] = useState<CalendarEvent | null>(null),
    [editor, setEditor] = useState(false),
    [editing, setEditing] = useState<CalendarEvent | null>(null),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [newDate, setNewDate] = useState(today);
  const days = monthDays(month),
    from = view === "month" ? days[0] : rangeStart,
    to =
      view === "month"
        ? Temporal.PlainDate.from(days[41]).add({ days: 1 }).toString()
        : Temporal.PlainDate.from(rangeStart).add({ days: 365 }).toString();
  const queryURL = `/api/calendar?${new URLSearchParams({ from, to, timezone: zone, offset: String(offset) })}`;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await request<{ events: CalendarEvent[] }>(queryURL, {
          signal,
        });
        setEvents((old) =>
          offset ? [...old, ...result.events] : result.events,
        );
        setHasMore(result.events.length === 100);
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [queryURL, offset],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, revision]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    if (id && !opened) {
      const event = events.find((e) => e.id === id);
      if (event) setOpened(event);
    }
  }, [events, opened]);
  const open = (e: CalendarEvent) => {
    setOpened(e);
    setEditing(null);
    setDeleting(false);
    setError("");
  };
  const close = () => {
    setOpened(null);
    setDeleting(false);
    const u = new URL(window.location.href);
    u.searchParams.delete("event");
    window.history.replaceState(null, "", u);
  };
  const add = (date = today) => {
    setNewDate(date);
    setEditing(null);
    setEditor(true);
    setNotice("");
  };
  const sorted = [...events].sort(
    (a, b) =>
      eventDate(a, zone).localeCompare(eventDate(b, zone)) ||
      (a.starts_at || "").localeCompare(b.starts_at || "") ||
      a.id.localeCompare(b.id),
  );
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of sorted) {
    const date = eventDate(e, zone) < from ? from : eventDate(e, zone);
    groups.set(date, [...(groups.get(date) || []), e]);
  }
  const changeView = (value: string) => {
    setOffset(0);
    setView(value);
  };
  return (
    <>
      <Heading
        title="Calendar"
        description="Where to be, when to be there, and what to bring."
      >
        <button className="button primary" onClick={() => add()}>
          <Plus size={16} /> Add event
        </button>
      </Heading>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="calendar-notice" role="status">
          {notice}
        </p>
      )}
      <div className="calendar-toolbar">
        <div className="tabs" role="group" aria-label="Calendar views">
          {["upcoming", "month"].map((v) => (
            <button
              className={`tab ${view === v ? "active" : ""}`}
              aria-pressed={view === v}
              key={v}
              onClick={() => changeView(v)}
            >
              {v === "upcoming" ? "Upcoming" : "Month"}
            </button>
          ))}
        </div>
        <span className="muted">Times in {zone.replaceAll("_", " ")}</span>
      </div>
      {view === "upcoming" ? (
        <>
          <div className="calendar-range">
            <span className="muted">
              {dateLabel(from, true)} —{" "}
              {dateLabel(
                Temporal.PlainDate.from(to).subtract({ days: 1 }).toString(),
                true,
              )}
            </span>
            <div className="actions">
              <button
                className="button small"
                onClick={() => {
                  setOffset(0);
                  setRangeStart(today);
                }}
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label="Previous year of events"
                onClick={() => {
                  setOffset(0);
                  setRangeStart(
                    Temporal.PlainDate.from(from)
                      .subtract({ days: 365 })
                      .toString(),
                  );
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next year of events"
                onClick={() => {
                  setOffset(0);
                  setRangeStart(to);
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-agenda">
            {[...groups].map(([date, group]) => (
              <section className="calendar-day" key={date}>
                <h2>{date === today ? "Today" : dateLabel(date)}</h2>
                <div>
                  {group.map((e) => (
                    <button
                      className="calendar-event"
                      key={e.id}
                      onClick={() => open(e)}
                    >
                      <span className="calendar-event-title">{e.title}</span>
                      <span className="muted">
                        {e.event_type} · {eventTime(e, zone)}
                        {e.location_name ? ` · ${e.location_name}` : ""}
                      </span>
                      {eventLastDate(e, zone) > date && (
                        <span className="muted">
                          Until {dateLabel(eventLastDate(e, zone))}
                        </span>
                      )}
                      {e.items.length > 0 && (
                        <span className="calendar-equipment-count">
                          {e.items.filter((i) => i.completed).length}/
                          {e.items.length} packed
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {!loading && !events.length && (
            <Empty
              title="Your next date starts here."
              description="Add a gig, rehearsal or anything else you need to remember."
            >
              <button className="button" onClick={() => add()}>
                Add event
              </button>
            </Empty>
          )}
        </>
      ) : (
        <>
          <div className="calendar-month-header">
            <h2>
              {new Intl.DateTimeFormat("en-GB", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(month + "-01T12:00:00Z"))}
            </h2>
            <div className="actions">
              <button
                className="button small"
                onClick={() => {
                  setOffset(0);
                  setMonth(today.slice(0, 7));
                }}
              >
                Today
              </button>
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => {
                  setOffset(0);
                  setMonth(
                    Temporal.PlainDate.from(month + "-01")
                      .subtract({ months: 1 })
                      .toString()
                      .slice(0, 7),
                  );
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => {
                  setOffset(0);
                  setMonth(
                    Temporal.PlainDate.from(month + "-01")
                      .add({ months: 1 })
                      .toString()
                      .slice(0, 7),
                  );
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div
            className="calendar-month"
            role="group"
            aria-label="Month starting Monday"
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div className="calendar-weekday" key={d}>
                {d}
              </div>
            ))}
            {days.map((date) => (
              <div
                key={date}
                className={`calendar-cell ${date.slice(0, 7) !== month ? "outside" : ""} ${date === today ? "today" : ""}`}
              >
                <button
                  className="calendar-date"
                  aria-label={`Add event on ${date}`}
                  onClick={() => add(date)}
                >
                  {Number(date.slice(8))}
                </button>
                {sorted
                  .filter(
                    (e) =>
                      eventDate(e, zone) <= date &&
                      eventLastDate(e, zone) >= date,
                  )
                  .map((e) => (
                    <button
                      key={e.id}
                      className="calendar-month-event"
                      title={`${e.title} · ${eventTime(e, zone)}`}
                      aria-label={`${e.title} on ${date}`}
                      onClick={() => open(e)}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </>
      )}
      {loading && <p role="status">Loading events…</p>}
      {hasMore && (
        <button
          className="button"
          disabled={loading}
          onClick={() => setOffset(offset + 100)}
        >
          Load more events
        </button>
      )}
      <Dialog
        open={editor}
        onOpenChange={(v) => {
          setEditor(v);
          if (!v) setEditing(null);
        }}
        title={editing ? "Edit event" : "Add event"}
        description="A title and date are all you need. Add the details when you’re ready."
      >
        <EventForm
          key={editing?.id || `${newDate}-${editor}`}
          w={w}
          event={editing}
          date={newDate}
          onCancel={() => {
            setEditor(false);
            setEditing(null);
          }}
          onSave={async (input) => {
            const { event } = await send({
              action: "save",
              ...(editing ? { id: editing.id } : {}),
              event: input,
            });
            setEditor(false);
            setEditing(null);
            if (event) {
              setOpened(event);
              setNotice("Event saved.");
            }
            setOffset(0);
            setRevision((r) => r + 1);
          }}
        />
      </Dialog>
      <Dialog
        open={!!opened && !editor}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        title={opened?.title || "Event"}
        description={
          opened
            ? `${opened.event_type} · ${dateLabel(eventDate(opened, zone))} · ${eventTime(opened, zone)}`
            : undefined
        }
        drawer
      >
        {opened && (
          <div className="calendar-detail">
            {opened.location_name && (
              <p className="calendar-location">
                <strong>{opened.location_name}</strong>
                {opened.address && <span>{opened.address}</span>}
              </p>
            )}
            {!opened.location_name && opened.address && <p>{opened.address}</p>}
            {eventLastDate(opened, zone) > eventDate(opened, zone) && (
              <p>Until {dateLabel(eventLastDate(opened, zone))}</p>
            )}
            {opened.artist_entity_id && (
              <p className="muted">Project: {w.artistName}</p>
            )}
            {opened.contact_id && (
              <p className="muted">
                Contact:{" "}
                {w.contacts.find((c) => c.id === opened.contact_id)
                  ? contactName(
                      w.contacts.find((c) => c.id === opened.contact_id)!,
                    )
                  : "Linked network contact"}
              </p>
            )}
            <section>
              <h3>What to bring</h3>
              {opened.items.length ? (
                <div className="calendar-checklist">
                  {opened.items.map((i) => (
                    <label
                      key={i.id}
                      className={`calendar-check ${i.completed ? "completed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={i.completed}
                        onChange={async (ev) => {
                          const completed = ev.target.checked;
                          const previous = opened;
                          setOpened({
                            ...opened,
                            items: opened.items.map((item) =>
                              item.id === i.id ? { ...item, completed } : item,
                            ),
                          });
                          setBusy(true);
                          setError("");
                          try {
                            const result = await send({
                              action: "check",
                              id: opened.id,
                              itemId: i.id,
                              completed,
                            });
                            if (result.event) {
                              setOpened(result.event);
                              setEvents((old) =>
                                old.map((e) =>
                                  e.id === result.event!.id ? result.event! : e,
                                ),
                              );
                            }
                          } catch (e) {
                            setOpened(previous);
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                      <span>
                        {i.quantity ? `${i.quantity} × ` : ""}
                        {i.label}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted">Nothing on the checklist yet.</p>
              )}
            </section>
            {opened.event_type === "Gig" && (
              <section className="gig-timings">
                <h3>Gig details</h3>
                <dl>
                  {(
                    [
                      ["Load-in", opened.load_in_at],
                      ["Soundcheck", opened.soundcheck_at],
                      ["Doors", opened.doors_at],
                      ["Stage", opened.stage_at],
                    ] as const
                  ).map(
                    ([name, time]) =>
                      time && (
                        <div key={name}>
                          <dt>{name}</dt>
                          <dd>{timeLabel(time, zone)}</dd>
                        </div>
                      ),
                  )}
                  {opened.promoter && (
                    <div>
                      <dt>Promoter</dt>
                      <dd>{opened.promoter}</dd>
                    </div>
                  )}
                  {opened.fee && (
                    <div>
                      <dt>Fee</dt>
                      <dd>{opened.fee}</dd>
                    </div>
                  )}
                </dl>
                {opened.ticket_url && (
                  <a
                    className="button small"
                    href={opened.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Tickets ↗
                  </a>
                )}
              </section>
            )}
            {opened.notes && (
              <section>
                <h3>Notes</h3>
                <p className="calendar-notes">{opened.notes}</p>
              </section>
            )}
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                className="button"
                onClick={() => {
                  setEditing(opened);
                  setEditor(true);
                }}
              >
                Edit event
              </button>
              <button
                className="button danger"
                onClick={() => setDeleting(true)}
              >
                Delete event
              </button>
            </div>
            <details className="disclosure">
              <summary>Add to external calendar</summary>
              <p className="muted">
                Creates a copy. Future changes stay in MusicMail.
              </p>
              <div className="actions">
                <a
                  className="button"
                  href={googleCalendarURL(opened)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Calendar ↗
                </a>
                <a
                  className="button"
                  href={`/api/calendar/${opened.id}/export`}
                >
                  Apple / Outlook (.ics)
                </a>
              </div>
              {eventDetails(opened).length > 2000 && (
                <p className="muted">
                  Google’s link includes the first 2,000 characters of details.
                  The ICS download includes everything.
                </p>
              )}
            </details>
            {deleting && (
              <div className="calendar-delete" role="alert">
                <p>
                  Delete this event and its checklist? This cannot be undone.
                </p>
                <div className="actions">
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await send({ action: "delete", id: opened.id });
                        close();
                        setNotice("Event deleted.");
                        setEvents((old) =>
                          old.filter((e) => e.id !== opened.id),
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm delete
                  </button>
                  <button className="button" onClick={() => setDeleting(false)}>
                    Keep event
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
function EventForm({
  w,
  event,
  date,
  onSave,
  onCancel,
}: {
  w: Workspace;
  event: CalendarEvent | null;
  date: string;
  onSave: (input: EventInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState<EventInput>(() =>
    event
      ? eventToInput(event)
      : {
          title: "",
          date,
          event_type: "Gig",
          start_time: "",
          end_time: "",
          all_day: false,
          timezone: w.profile?.timezone || "Europe/London",
          items: [],
        },
  );
  const [items, setItems] = useState(v.items || []),
    [newItem, setNewItem] = useState(""),
    [quantity, setQuantity] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [venues, setVenues] = useState<Entity[]>([]),
    [venueSearch, setVenueSearch] = useState("");
  const patch = (key: keyof EventInput, value: unknown) =>
    setV((old) => ({
      ...old,
      [key]: key === "end_date" && !value ? undefined : value,
    }));
  useEffect(() => {
    if (!venueSearch.trim()) {
      setVenues([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      request<{ items: Entity[] }>(
        `/api/explore?${new URLSearchParams({ filters: JSON.stringify({ q: venueSearch, types: ["venue"], page: 1 }) })}`,
        { signal: controller.signal },
      )
        .then((r) => setVenues(r.items))
        .catch(() => {
          if (!controller.signal.aborted) setVenues([]);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [venueSearch]);
  const addItem = () => {
    if (!newItem.trim()) return;
    setItems((old) => [
      ...old,
      {
        label: newItem.trim(),
        quantity: quantity ? Number(quantity) : null,
        completed: false,
      },
    ]);
    setNewItem("");
    setQuantity("");
  };
  const field = (
    key: keyof EventInput,
    label: string,
    type = "text",
    maxLength?: number,
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={String(v[key] || "")}
        maxLength={maxLength}
        onChange={(e) => patch(key, e.target.value)}
      />
    </label>
  );
  return (
    <form
      className="calendar-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const checklist = newItem.trim()
            ? [
                ...items,
                {
                  label: newItem.trim(),
                  quantity: quantity ? Number(quantity) : null,
                  completed: false,
                },
              ]
            : items;
          const input = { ...v, items: checklist };
          normaliseEvent(input);
          await onSave(input);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <label>
        Title *
        <input
          required
          maxLength={200}
          value={v.title}
          onChange={(e) => patch("title", e.target.value)}
          placeholder="Your next gig"
        />
      </label>
      <div className="field-grid">
        <label>
          Date *
          <input
            type="date"
            required
            min="1900-01-01"
            max="2200-12-31"
            value={v.date}
            onChange={(e) => patch("date", e.target.value)}
          />
        </label>
        <label>
          Event type
          <select
            value={v.event_type}
            onChange={(e) => patch("event_type", e.target.value)}
          >
            {eventTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="calendar-check">
        <input
          type="checkbox"
          checked={!!v.all_day}
          onChange={(e) => {
            patch("all_day", e.target.checked);
            if (e.target.checked) {
              patch("start_time", "");
              patch("end_time", "");
            }
          }}
        />
        <span>All day</span>
      </label>
      {!v.all_day && (
        <div className="field-grid">
          {field("start_time", "Start time", "time")}
          {field("end_time", "End time", "time")}
        </div>
      )}
      <p className="calendar-hint muted">
        {v.start_time && !v.all_day
          ? `Times in ${v.timezone}. One hour if no end time is set.`
          : "Leave times blank for a date-only event."}
      </p>
      {field("location_name", "Location / venue", "text", 200)}
      <section className="calendar-items-editor">
        <h3>What to bring</h3>
        {items.map((i, n) => (
          <div className="calendar-item-edit" key={i.id || `new-${n}`}>
            <span>
              {i.quantity ? `${i.quantity} × ` : ""}
              {i.label}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${i.label}`}
              onClick={() => setItems((old) => old.filter((_, x) => x !== n))}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="calendar-item-add">
          <label>
            Item
            <input
              value={newItem}
              maxLength={200}
              placeholder="Martin D-28"
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
          </label>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={999}
              value={quantity}
              placeholder="1"
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={addItem}
            disabled={!newItem.trim() || items.length >= 100}
          >
            Add item
          </button>
        </div>
      </section>
      {v.event_type === "Gig" && (
        <details className="disclosure">
          <summary>Gig details</summary>
          <div className="stack">
            {field("address", "Address", "text", 500)}
            {field("promoter", "Promoter / contact", "text", 200)}
            <div className="field-grid">
              {field("load_in_time", "Load-in time", "time")}
              {field("soundcheck_time", "Soundcheck time", "time")}
              {field("doors_time", "Doors time", "time")}
              {field("stage_time", "Stage time", "time")}
            </div>
            <p className="muted">
              Gig timings use the event date and time zone.
            </p>
            {field("fee", "Fee", "text", 100)}
            {field("ticket_url", "Ticket URL", "url", 2000)}
          </div>
        </details>
      )}
      <label>
        Notes
        <textarea
          rows={3}
          maxLength={10000}
          value={v.notes || ""}
          onChange={(e) => patch("notes", e.target.value)}
        />
      </label>
      <details className="disclosure">
        <summary>More options</summary>
        <div className="stack">
          {field(
            "end_date",
            v.all_day ? "Last day (inclusive)" : "End date",
            "date",
          )}
          {field("timezone", "Time zone", "text", 100)}
          <label>
            When clocks repeat
            <select
              value={v.disambiguation || "reject"}
              onChange={(e) => patch("disambiguation", e.target.value)}
            >
              <option value="reject">Ask me to choose</option>
              <option value="earlier">First occurrence</option>
              <option value="later">Second occurrence</option>
            </select>
          </label>
          <label>
            Network contact
            <select
              value={v.contact_id || ""}
              onChange={(e) => patch("contact_id", e.target.value || null)}
            >
              <option value="">No linked contact</option>
              {w.contacts
                .filter((c) => !c.archived)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactName(c)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Artist / project
            <select
              value={v.artist_entity_id || ""}
              onChange={(e) =>
                patch("artist_entity_id", e.target.value || null)
              }
            >
              <option value="">No linked project</option>
              {w.artist && <option value={w.artist.id}>{w.artistName}</option>}
            </select>
          </label>
          <label>
            Find a MusicMail venue
            <input
              value={venueSearch}
              maxLength={100}
              onChange={(e) => setVenueSearch(e.target.value)}
              placeholder="Search existing venues"
            />
          </label>
          {venues.map((e) => (
            <button
              className={`button ${v.venue_entity_id === e.id ? "primary" : ""}`}
              type="button"
              key={e.id}
              onClick={() => {
                patch("venue_entity_id", e.id);
                if (!v.location_name) patch("location_name", e.display_name);
                setVenueSearch("");
              }}
            >
              Link {e.display_name}
            </button>
          ))}
          {v.venue_entity_id && (
            <div className="actions">
              <span className="muted">MusicMail venue linked</span>
              <button
                type="button"
                className="button small"
                onClick={() => patch("venue_entity_id", null)}
              >
                Remove venue link
              </button>
            </div>
          )}
          <p className="muted">
            Typed venue names stay private. No shared entity is created.
          </p>
        </div>
      </details>
      <div className="form-footer">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save event"}
        </button>
      </div>
    </form>
  );
}
