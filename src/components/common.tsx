"use client";
import { Music2, Sparkles, Plus, Check } from "lucide-react";
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
}: {
  values: string[];
  emotion?: boolean;
}) {
  return (
    <>
      {values.map((value) => (
        <span key={value} className={`tag ${emotion ? "emotion" : ""}`}>
          {value}
        </span>
      ))}
    </>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={27} style={{ margin: "auto" }} />
      <h3>{title}</h3>
      <p>{description}</p>
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
    </button>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
