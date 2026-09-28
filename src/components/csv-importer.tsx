"use client";
import { useState } from "react";
import { request } from "@/lib/client";
import { Upload, ArrowRight, Check } from "lucide-react";
import { parseCsv, validateRows, csvFields, type CsvField } from "@/lib/csv";
import type { Action, Workspace } from "@/lib/domain";
import { Dialog } from "./ui/dialog";
export function CsvImporter({
  open,
  onClose,
  workspace,
  mutate,
}: {
  open: boolean;
  onClose: () => void;
  workspace: Workspace;
  mutate: (a: Action) => Promise<void>;
}) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<CsvField, string>>({
    name: "",
    email: "",
    organisation: "",
    role: "",
    location: "",
    genres: "",
    notes: "",
    relationship: "",
  });
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverDuplicates, setServerDuplicates] = useState<number[]>([]);
  const validated = validateRows(rows, mapping, workspace.contacts).map(
    (r, i) => ({
      ...r,
      duplicate: r.duplicate || serverDuplicates.includes(i),
    }),
  );
  const duplicates = validated.filter((r) => r.duplicate).length;
  const invalid = validated.filter((r) => r.error).length;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Bring your people with you."
      description="Import up to 500 contacts from a CSV. Everything stays private."
    >
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="step-indicator">
        {[0, 1, 2].map((i) => (
          <span key={i} className={step >= i ? "current" : ""} />
        ))}
      </div>
      {step === 0 ? (
        <>
          <label className="field">
            Choose a CSV file
            <input
              aria-label="CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2_000_000)
                    throw new Error("Choose a file smaller than 2 MB.");
                  const result = parseCsv(await file.text());
                  setHeaders(result.headers);
                  setRows(result.rows);
                  setMapping(
                    Object.fromEntries(
                      csvFields.map((f) => [
                        f,
                        result.headers.find(
                          (h) =>
                            h.toLowerCase() === f ||
                            (f === "organisation" &&
                              h.toLowerCase() === "company"),
                        ) || "",
                      ]),
                    ) as Record<CsvField, string>,
                  );
                  setStep(1);
                  setError("");
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          </label>
          <div className="source-box">
            <Upload size={20} />
            <p>
              Include a header row. Name is required; email, company, role,
              location, genre and notes are optional.
            </p>
          </div>
        </>
      ) : step === 1 ? (
        <>
          <p className="muted">
            Match your spreadsheet columns to MusicMail fields.
          </p>
          <div className="field-grid">
            {csvFields.map((f) => (
              <label className="field" key={f}>
                {f === "name"
                  ? "Name *"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
                <select
                  aria-label={`Map ${f}`}
                  value={mapping[f]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f]: e.target.value })
                  }
                >
                  <option value="">Do not import</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="form-footer">
            <button className="button" onClick={() => setStep(0)}>
              Back
            </button>
            <button
              className="button primary"
              disabled={!mapping.name || busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (!invalid && validated.length) {
                    const r = await request<{ duplicates: number[] }>(
                      "/api/import/preview",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          contacts: validated.map((r) => r.contact),
                        }),
                      },
                    );
                    setServerDuplicates(r.duplicates);
                  }
                  setStep(2);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Validate & preview <ArrowRight size={14} />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {rows.length} rows · {invalid} invalid · {duplicates} possible
            duplicates
          </p>
          <div className="csv-preview table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Validation</th>
                </tr>
              </thead>
              <tbody>
                {validated.map((r) => (
                  <tr key={r.index}>
                    <td>{r.index}</td>
                    <td>{r.input.name}</td>
                    <td>{r.input.email}</td>
                    <td>
                      {r.error ||
                        (r.duplicate ? "Possible duplicate" : "Ready")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invalid > 0 && (
            <p className="error-banner">
              Fix invalid rows in your CSV and upload it again. Nothing has been
              imported.
            </p>
          )}
          {duplicates > 0 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Import possible duplicates as separate private contacts
            </label>
          )}
          <div className="form-footer">
            <button className="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                invalid > 0 ||
                !rows.length ||
                (duplicates > 0 && !confirmed)
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate({
                    action: "import",
                    contacts: validated.flatMap((r) =>
                      r.contact ? [r.contact] : [],
                    ),
                    confirmDuplicates: confirmed,
                  });
                  onClose();
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={14} />
              {busy ? "Importing…" : `Import ${rows.length} contacts`}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
