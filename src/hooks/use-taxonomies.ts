"use client";
import { useState, useEffect } from "react";
import { request } from "@/lib/client";
import { genres, emotions, cities, roleNames, orgTypes } from "@/lib/fixtures";
const initial = {
  genres,
  emotions,
  cities,
  roles: roleNames,
  organisationTypes: orgTypes,
};
export function useTaxonomies() {
  const [data, setData] = useState(initial);
  useEffect(() => {
    const controller = new AbortController();
    request<typeof initial>("/api/taxonomies", { signal: controller.signal })
      .then(setData)
      .catch(() => {
        /* Seed taxonomy is a safe fallback while the workspace shows connection errors. */
      });
    return () => controller.abort();
  }, []);
  return data;
}
