const BASE = import.meta.env.VITE_PUBLIC_API_URL || '';

export const GENRES = {
  1: 'Soccer', 2: 'Basketball', 3: 'Tennis', 4: 'Ice Hockey',
  5: 'Motorsport', 6: 'Fighting', 7: 'Baseball', 8: 'American Football',
};

export async function fetchMatches() {
  const res = await fetch(`${BASE}/api/public/matches`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.matches || [];
}

export async function fetchMatch(slug) {
  const res = await fetch(`${BASE}/api/public/match/${slug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.match || null;
}
