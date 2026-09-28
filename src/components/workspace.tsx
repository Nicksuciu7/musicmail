"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home as HomeIcon,
  Compass,
  Users,
  Folder,
  Mail,
  FileText,
  Settings as SettingsIcon,
  Music2,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  Bookmark,
} from "lucide-react";
import { request, updateWorkspace } from "@/lib/client";
import {
  emptyFilters,
  parseFilters,
  type Workspace as WorkspaceData,
  type Entity,
  type Contact,
  type Action,
  type Filters,
} from "@/lib/domain";
import { Brand } from "./common";
import { Explore } from "./explore";
import { Network } from "./network";
import { ContactDrawer } from "./contact-drawer";
import { CsvImporter } from "./csv-importer";
import { Composer } from "./composer";
import {
  Home,
  Lists,
  MailScreen,
  Templates,
  Settings,
  NewContact,
  RecipientPicker,
} from "./screens";
import { Dialog } from "./ui/dialog";
import { Admin } from "./admin";
const nav = [
  ["home", "Home", HomeIcon],
  ["explore", "Explore", Compass],
  ["network", "My Network", Users],
  ["lists", "Lists", Folder],
  ["mail", "Mail", Mail],
  ["templates", "Templates", FileText],
] as const;
export function Workspace({ page }: { page: string }) {
  const router = useRouter();
  const [w, setW] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [filters, setFilterState] = useState<Filters>(emptyFilters);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [contactId, setContactId] = useState("");
  const [newContact, setNewContact] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saveView, setSaveView] = useState(false);
  const [viewColumns, setViewColumns] = useState<string[]>([]);
  const [viewName, setViewName] = useState("");
  const [emailIds, setEmailIds] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [mobile, setMobile] = useState(false);
  const report = useCallback((s: string) => setError(s), []);
  const refresh = useCallback(async () => {
    try {
      setW(await request<WorkspaceData>("/api/workspace"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    setFilterState(
      parseFilters(new URLSearchParams(window.location.search).get("filters")),
    );
    if (new URLSearchParams(window.location.search).get("gmail") === "failed")
      setError(
        "Gmail connection failed. Check your OAuth configuration and try again.",
      );
  }, [refresh, page]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const setFilters = (f: Filters) => {
    setFilterState(f);
    const u = new URL(window.location.href);
    u.searchParams.set("filters", JSON.stringify(f));
    window.history.replaceState(null, "", u);
  };
  const mutate = async (a: Action) => {
    try {
      setW(await updateWorkspace(a));
      setToast(
        a.action === "note"
          ? "Private note saved"
          : a.action === "add"
            ? "Added to your network"
            : a.action === "import"
              ? "Your contacts are ready"
              : "Saved",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };
  const add = async (e: Entity) => {
    try {
      await mutate({ action: "add", entityId: e.id });
    } catch {}
  };
  const openContact = async (c: Contact) => {
    try {
      const data = await request<WorkspaceData>(
        `/api/workspace?contactIds=${c.id}`,
      );
      setW(data);
      setContactId(c.id);
      setEntity(null);
    } catch (e) {
      report((e as Error).message);
    }
  };
  const compose = async (ids: string[]) => {
    try {
      setW(
        await request<WorkspaceData>(
          `/api/workspace?contactIds=${ids.join(",")}`,
        ),
      );
    } catch (e) {
      report((e as Error).message);
      return;
    }
    setContactId("");
    setEntity(null);
    setPicker(false);
    setEmailIds(ids);
  };
  const gotoView = (f: Filters, target = "explore") => {
    setFilterState(f);
    router.push(`/${target}?filters=${encodeURIComponent(JSON.stringify(f))}`);
  };
  useEffect(() => {
    const restore = () =>
      setFilterState(
        parseFilters(
          new URLSearchParams(window.location.search).get("filters"),
        ),
      );
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  return (
    <div className="app-shell">
      <div
        className={`menu-backdrop ${mobile ? "visible" : ""}`}
        onClick={() => setMobile(false)}
      />
      <aside className={`sidebar ${mobile ? "visible" : ""}`}>
        <Link href="/explore">
          <Brand />
        </Link>
        <div className="brand-sub">A GREENROOM NETWORK PRODUCT</div>
        <Link href="/onboarding" className="workspace-switch">
          <span className="project-icon">
            <Music2 size={17} />
          </span>
          <div style={{ flex: 1 }}>
            {w?.onboarded ? w.artistName : "Your artist workspace"}
            <small>{w?.demo ? "Demo workspace" : "Personal workspace"}</small>
          </div>
          <ChevronDown size={12} />
        </Link>
        <div className="nav-section">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([path, title, Icon]) => (
            <Link
              className={`nav-link ${page === path ? "active" : ""}`}
              key={path}
              href={`/${path}`}
              onClick={() => setMobile(false)}
            >
              <Icon size={17} strokeWidth={1.6} />
              {title}
              {path === "network" && !!w?.contactCount && (
                <span className="nav-count">{w.contactCount}</span>
              )}
            </Link>
          ))}
        </nav>
        {!!w?.views.length && (
          <>
            <div className="nav-section">SAVED VIEWS</div>
            {w.views.slice(0, 4).map((v) => (
              <button
                key={v.id}
                className="nav-link"
                style={{ background: "none", border: 0, textAlign: "left" }}
                onClick={() => {
                  if (v.scope === "network" && v.visible_columns.length)
                    localStorage.setItem(
                      "musicmail-network-columns",
                      JSON.stringify(v.visible_columns),
                    );
                  gotoView(v.filter_definition, v.scope || "explore");
                }}
              >
                <Bookmark size={14} />
                {v.name}
              </button>
            ))}
          </>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            A little connection.
            <br />A world of possibility.{" "}
            <span style={{ color: "#586546" }}>✧</span>
          </div>
          {w?.isAdmin && (
            <Link
              className={`nav-link ${page === "admin" ? "active" : ""}`}
              href="/admin"
            >
              <ShieldCheck size={16} />
              Database admin
            </Link>
          )}
          <Link
            href="/settings"
            className={`nav-link ${page === "settings" ? "active" : ""}`}
          >
            <SettingsIcon size={17} strokeWidth={1.6} />
            Settings
          </Link>
          <div className="user-chip">
            <span className="user-avatar">
              {(w?.artistName || "M").slice(0, 1)}
            </span>
            <div style={{ flex: 1 }}>
              {w?.onboarded ? w.artistName : "Make yourself at home"}
              <small
                style={{
                  display: "block",
                  fontSize: 10,
                  color: "#5b6253",
                  marginTop: 4,
                }}
              >
                Independent. Together.
              </small>
            </div>
            <ChevronDown size={12} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-trail">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={19} />
            </button>
            <span>Your workspace</span>
            <span style={{ color: "#5e6158" }}>/</span>
            <strong style={{ fontWeight: 500, color: "#5a664f" }}>
              {nav.find((n) => n[0] === page)?.[1] ||
                (page === "admin" ? "Database admin" : "Settings")}
            </strong>
          </div>
          <div className="topbar-actions">
            {w?.demo && <span className="demo-pill">DEMO COLLECTION</span>}
            <Link
              className="icon-button"
              href="/home"
              aria-label="Your follow-ups"
            >
              <HomeIcon size={16} />
            </Link>
            <span
              className="user-avatar"
              style={{ width: 27, height: 27, fontSize: 10 }}
            >
              {w?.onboarded ? w.artistName.slice(0, 2).toUpperCase() : "MM"}
            </span>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error-banner" role="alert">
              <span>
                {error}
                {error.includes("sign in") && (
                  <>
                    {" "}
                    <Link href="/login">Go to login →</Link>
                  </>
                )}
              </span>
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {!w ? (
            <div aria-busy="true">
              {!error &&
                [1, 2, 3, 4].map((i) => <div className="skeleton" key={i} />)}
              {error && (
                <button className="button" onClick={() => void refresh()}>
                  Try again
                </button>
              )}
            </div>
          ) : (
            <>
              {page === "explore" && (
                <Explore
                  workspace={w}
                  filters={filters}
                  setFilters={setFilters}
                  onOpen={async (e) => {
                    try {
                      setW(
                        await request<WorkspaceData>(
                          `/api/workspace?entityId=${e.id}`,
                        ),
                      );
                      setEntity(e);
                      setContactId("");
                    } catch (err) {
                      report((err as Error).message);
                    }
                  }}
                  onAdd={add}
                  onSave={(columns?: string[]) => {
                    setViewColumns(columns || []);
                    setSaveView(true);
                  }}
                  onError={report}
                />
              )}
              {page === "network" && (
                <Network
                  workspace={w}
                  filters={filters}
                  setFilters={setFilters}
                  onOpen={openContact}
                  onNew={() => setNewContact(true)}
                  onImport={() => setImporting(true)}
                  onSave={(columns?: string[]) => {
                    setViewColumns(columns || []);
                    setSaveView(true);
                  }}
                  onEmail={compose}
                  mutate={mutate}
                />
              )}
              {page === "home" && (
                <Home
                  w={w}
                  onOpen={openContact}
                  onNew={() => setNewContact(true)}
                  onImport={() => setImporting(true)}
                  onView={gotoView}
                  onCompose={() => setPicker(true)}
                />
              )}
              {page === "lists" && (
                <Lists
                  w={w}
                  onSelect={(id) =>
                    gotoView({ ...emptyFilters, list: id }, "network")
                  }
                  mutate={mutate}
                />
              )}
              {page === "mail" && (
                <MailScreen w={w} onCompose={() => setPicker(true)} />
              )}
              {page === "templates" && <Templates w={w} mutate={mutate} />}
              {page === "settings" && <Settings w={w} refresh={refresh} />}
              {page === "admin" && <Admin enabled={w.isAdmin && !w.demo} />}
            </>
          )}
        </div>
      </main>
      {w && (
        <>
          <ContactDrawer
            entity={entity}
            contact={
              contactId
                ? w.contacts.find((c) => c.id === contactId)
                : entity
                  ? w.contacts.find(
                      (c) => c.entity_id === entity.id && !c.archived,
                    )
                  : undefined
            }
            workspace={w}
            onClose={() => {
              setEntity(null);
              setContactId("");
            }}
            mutate={mutate}
            onEmail={compose}
          />
          {newContact && (
            <NewContact
              open
              onClose={() => setNewContact(false)}
              mutate={mutate}
            />
          )}
          {importing && (
            <CsvImporter
              open
              onClose={() => setImporting(false)}
              workspace={w}
              mutate={mutate}
            />
          )}
          {emailIds.length > 0 && (
            <Composer
              ids={emailIds}
              w={w}
              onClose={() => setEmailIds([])}
              onSent={refresh}
            />
          )}
          {picker && (
            <RecipientPicker
              open
              w={w}
              onClose={() => setPicker(false)}
              onSelect={compose}
            />
          )}
          <Dialog
            open={saveView}
            onOpenChange={setSaveView}
            title="Find your way back."
            description="Save these filters as a view you can return to."
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await mutate({
                    action: "view",
                    name: viewName,
                    scope: page === "network" ? "network" : "explore",
                    filters,
                    columns: viewColumns,
                  });
                  setViewName("");
                  setSaveView(false);
                } catch {}
              }}
            >
              <label className="field">
                View name
                <input
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="London Folk Promoters"
                  required
                  maxLength={100}
                />
              </label>
              <button className="button primary">
                Save view <ArrowUpRight size={14} />
              </button>
            </form>
          </Dialog>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
