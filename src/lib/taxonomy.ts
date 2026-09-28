/** Seed hierarchy used by the synthetic adapter; hosted queries use canonical rows. */
export const genreParents: Record<string, string> = {
  "Indie Folk": "Folk",
  "Singer-Songwriter": "Folk",
  "Folk Rock": "Folk",
  "Traditional Folk": "Folk",
  "Contemporary Folk": "Folk",
  "Freak Folk": "Folk",
  "Indie Rock": "Rock",
  "Alternative Rock": "Rock",
  Shoegaze: "Rock",
  "Art Rock": "Rock",
  "Post-Rock": "Rock",
  Punk: "Rock",
  Ambient: "Electronic",
  House: "Electronic",
  Techno: "Electronic",
  IDM: "Electronic",
  "Experimental Electronic": "Electronic",
};
export function expandGenres(
  selected: string[],
  parents: Record<string, string>,
) {
  const result = new Set(selected);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [child, parent] of Object.entries(parents))
      if (result.has(parent) && !result.has(child)) {
        result.add(child);
        grew = true;
      }
  }
  return [...result];
}
