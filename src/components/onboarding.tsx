"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "./common";
import { useTaxonomies } from "@/hooks/use-taxonomies";
import { request, updateWorkspace } from "@/lib/client";
import type { Workspace, Action } from "@/lib/domain";
import { CsvImporter } from "./csv-importer";
export function Onboarding() {
  const router = useRouter();
  const { genres, emotions: allEmotions, cities } = useTaxonomies();
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showAllEmotions, setShowAllEmotions] = useState(false);
  const emotions = showAllEmotions
    ? allEmotions
    : [
        "Intimate",
        "Melancholic",
        "Warm",
        "Dreamy",
        "Haunting",
        "Dark",
        "Hopeful",
        "Energetic",
        "Romantic",
        "Reflective",
        "Euphoric",
        "Raw",
      ];
  const [step, setStep] = useState(0);
  const [w, setW] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [type, setType] =
    useState<Extract<Action, { action: "onboard" }>["type"]>("solo");
  const [location, setLocation] = useState("");
  const [selectedGenres, setGenres] = useState<string[]>([]);
  const [selectedEmotions, setEmotions] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    request<Workspace>("/api/workspace")
      .then((w) => {
        setW(w);
        if (w.onboarded) {
          setName(w.artistName);
          setGoals(w.goals);
          if (w.artist) {
            setType(w.artist.type);
            setLocation(w.artist.location);
            setGenres(w.artist.genres);
            setEmotions(w.artist.emotions);
          }
        }
      })
      .catch((e) => setError(e.message));
  }, []);
  const toggle = (
    v: string,
    values: string[],
    set: (v: string[]) => void,
    max = 20,
  ) =>
    set(
      values.includes(v)
        ? values.filter((x) => x !== v)
        : values.length < max
          ? [...values, v]
          : values,
    );
  const save = async () => {
    setBusy(true);
    try {
      setW(
        await updateWorkspace({
          action: "onboard",
          name,
          type,
          location,
          genres: selectedGenres,
          emotions: selectedEmotions,
          goals,
        }),
      );
      setStep(4);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const titles = [
    "What do you make music as?",
    "Where does your music call home?",
    "What does your music feel like?",
    "What’s your next chapter?",
    "Bring your people along.",
    "Ready for your next connection?",
  ];
  return (
    <main className="auth-wrap">
      <div className="auth-card onboard-card">
        <Link href="/">
          <Brand />
        </Link>
        <div
          className="step-indicator"
          aria-label={`Step ${step + 1} of ${titles.length}`}
        >
          {titles.map((_, i) => (
            <span className={i <= step ? "current" : ""} key={i} />
          ))}
        </div>
        <p className="eyebrow">
          YOUR ARTIST PROJECT · {step + 1} OF {titles.length}
        </p>
        <h1>{titles[step]}</h1>
        <p>
          {step === 0
            ? "Only your project name is required."
            : step === 2
              ? "Choose a few words that resonate. You can always skip this."
              : step === 4
                ? "Import your contacts now or skip for later."
                : step === 5
                  ? "Gmail is optional. Explore the directory first, or connect when you’re ready."
                  : "Optional — you can change this later."}
        </p>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {step === 0 && (
          <>
            <div className="choice-grid">
              {[
                ["solo", "Solo artist"],
                ["band", "Band"],
                ["duo", "Duo"],
                ["collective", "Collective"],
                ["producer_project", "Producer project"],
                ["dj_project", "DJ project"],
                ["other", "Other"],
              ].map(([id, text]) => (
                <button
                  aria-pressed={type === id}
                  className={`choice ${type === id ? "selected" : ""}`}
                  key={id}
                  onClick={() => setType(id as typeof type)}
                >
                  {text}
                </button>
              ))}
            </div>
            <label className="field">
              Artist / project name *
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The name on the record"
                maxLength={200}
                autoFocus
              />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <label className="field">
              Where are you based?
              <input
                list="cities"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Search a city…"
              />
              <datalist id="cities">
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
            <label className="field">
              What kind of music do you make?
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search genres…"
              />
            </label>
            <div className="choice-grid">
              {genres
                .filter((g) => g.toLowerCase().includes(search.toLowerCase()))
                .filter(
                  (g, i) =>
                    search ||
                    showAllGenres ||
                    selectedGenres.includes(g) ||
                    i < 12 ||
                    g === "Indie Folk",
                )
                .map((g) => (
                  <button
                    key={g}
                    aria-pressed={selectedGenres.includes(g)}
                    className={`choice ${selectedGenres.includes(g) ? "selected" : ""}`}
                    onClick={() => toggle(g, selectedGenres, setGenres, 5)}
                  >
                    {g}
                  </button>
                ))}
            </div>
            {!search && (
              <button
                className="clear-filters"
                aria-expanded={showAllGenres}
                onClick={() => setShowAllGenres(!showAllGenres)}
              >
                {showAllGenres ? "Fewer genres" : "All genres"}
              </button>
            )}
            <p className="muted">{selectedGenres.length}/5 genres · optional</p>
          </>
        )}
        {step === 2 && (
          <div className="choice-grid">
            {emotions.map((e) => (
              <button
                key={e}
                aria-pressed={selectedEmotions.includes(e)}
                className={`choice ${selectedEmotions.includes(e) ? "selected" : ""}`}
                onClick={() => toggle(e, selectedEmotions, setEmotions, 12)}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <button
            className="clear-filters"
            onClick={() => setShowAllEmotions(!showAllEmotions)}
          >
            {showAllEmotions ? "Show fewer feelings" : "See more feelings"}
          </button>
        )}
        {step === 3 && (
          <div className="choice-grid">
            {[
              "Book gigs",
              "Find promoters",
              "Contact labels",
              "Find press",
              "Find radio",
              "Apply to festivals",
              "Find management",
              "Find booking agents",
              "Find collaborators",
              "Organise existing contacts",
            ].map((g) => (
              <button
                aria-pressed={goals.includes(g)}
                className={`choice ${goals.includes(g) ? "selected" : ""}`}
                key={g}
                onClick={() => toggle(g, goals, setGoals, 10)}
              >
                {g}
              </button>
            ))}
          </div>
        )}
        {step === 4 && (
          <button className="button" onClick={() => setImporting(true)}>
            Import a CSV
          </button>
        )}
        {step === 5 && (
          <>
            <Link className="button" href="/settings">
              Connect Gmail in Settings
            </Link>
            <p className="muted" style={{ marginTop: 15 }}>
              You can send when you’re ready. No inbox access needed.
            </p>
          </>
        )}
        <div className="form-footer">
          {step > 0 ? (
            <button className="button" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <Link className="muted" href="/explore">
              Look around first
            </Link>
          )}
          {step > 0 && step < 4 && (
            <button
              className="clear-filters"
              disabled={busy || !w}
              onClick={() => (step === 3 ? void save() : setStep(step + 1))}
            >
              Skip
            </button>
          )}
          <button
            className="button primary"
            disabled={!name.trim() || busy || !w}
            onClick={() => {
              if (step === 3) void save();
              else if (step === 5) {
                const f = {
                  locations: location ? [location] : [],
                  genres: selectedGenres,
                  roles: goals.includes("Find promoters") ? ["Promoter"] : [],
                };
                router.push(
                  `/explore?filters=${encodeURIComponent(JSON.stringify(f))}`,
                );
              } else setStep(step + 1);
            }}
          >
            {busy
              ? "Saving…"
              : step === 5
                ? "Find my people →"
                : step === 4
                  ? "Continue without import →"
                  : "Continue →"}
          </button>
        </div>
      </div>
      {importing && w && (
        <CsvImporter
          open
          onClose={() => setImporting(false)}
          workspace={w}
          mutate={async (a) => setW(await updateWorkspace(a))}
        />
      )}
    </main>
  );
}
