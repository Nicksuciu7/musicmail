"use client";
import { Music2, Plus, Check } from "lucide-react";
import type { Entity } from "@/lib/domain";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Music2 size={19} />
      </span>
      MusicMail<span style={{ color: "#5a634f", fontSize: 20 }}>.</span>
    </div>
  );
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={`entity-avatar tone-${index % 4}`}>
      {name
        .replace(/^The /, "")
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function Tags({
  values,
  emotion = false,
  limit = 3,
}: {
  values: string[];
  emotion?: boolean;
  limit?: number;
}) {
  return (
    <>
      {values.slice(0, limit).map((value) => (
        <span key={value} className={`tag ${emotion ? "emotion" : ""}`}>
          {value}
        </span>
      ))}
      {values.length > limit && (
        <span
          className="tag-count"
          aria-label={`${values.length - limit} more tags`}
        >
          +{values.length - limit}
        </span>
      )}
    </>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function AddButton({
  added,
  onClick,
  entity,
  busy,
}: {
  added: boolean;
  onClick: () => void;
  entity: Entity;
  busy?: boolean;
}) {
  return (
    <button
      disabled={busy || added}
      className={`add-button ${added ? "added" : ""}`}
      onClick={onClick}
      aria-label={
        added
          ? `${entity.display_name} is in your network`
          : `Add ${entity.display_name} to My Network`
      }
    >
      {added ? <Check size={14} /> : <Plus size={14} />}
      {added ? "In My Network" : "Add to My Network"}
    </button>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
