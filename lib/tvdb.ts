const TVDB_BASE_URL = "https://api4.thetvdb.com/v4";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();

  // Token valid for 24 hours; refresh if within 5 minutes of expiry
  if (tokenCache && tokenCache.expiresAt - now > 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const response = await fetch(`${TVDB_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: process.env.TVDB_API_KEY }),
  });

  if (!response.ok) {
    throw new Error(`TVDB auth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const token: string = data.data.token;

  // TVDB tokens expire in 30 days, but we cache for 23 hours to be safe
  tokenCache = {
    token,
    expiresAt: now + 23 * 60 * 60 * 1000,
  };

  return token;
}

async function tvdbFetch(path: string): Promise<unknown> {
  const token = await getToken();
  const response = await fetch(`${TVDB_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TVDB request failed: ${response.status} ${response.statusText} for ${path}`);
  }

  return response.json();
}

export interface TvdbSearchResult {
  tvdb_id: string;
  name: string;
  overview?: string;
  image_url?: string;
  status?: string;
  network?: string;
  first_air_time?: string;
  year?: string;
  type?: string;
  remote_ids?: Array<{ id: string; type: number; sourceName: string }>;
}

export interface TvdbShow {
  id: number;
  name: string;
  overview?: string;
  image?: string;
  status?: { name: string };
  originalNetwork?: { name: string };
  averageRuntime?: number;
}

export interface TvdbEpisode {
  id: number;
  seasonNumber: number;
  number: number;
  name?: string;
  overview?: string;
  aired?: string;
  runtime?: number;
}

export async function searchShows(query: string): Promise<TvdbSearchResult[]> {
  const encoded = encodeURIComponent(query);
  const data = await tvdbFetch(`/search?query=${encoded}&type=series`) as {
    data?: TvdbSearchResult[];
    status?: string;
  };

  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  return data.data.filter((item) => item.type === "series" || !item.type);
}

export async function getShow(tvdbId: number): Promise<TvdbShow | null> {
  try {
    const data = await tvdbFetch(`/series/${tvdbId}/extended`) as {
      data?: TvdbShow;
    };
    return data.data ?? null;
  } catch {
    return null;
  }
}

export async function getEpisodes(tvdbId: number): Promise<TvdbEpisode[]> {
  const allEpisodes: TvdbEpisode[] = [];
  let page = 0;

  while (true) {
    const data = await tvdbFetch(
      `/series/${tvdbId}/episodes/default?page=${page}`
    ) as {
      data?: {
        episodes?: TvdbEpisode[];
      };
    };

    const episodes = data.data?.episodes;

    if (!episodes || episodes.length === 0) {
      break;
    }

    allEpisodes.push(...episodes);

    // TVDB returns 100 episodes per page; if we got fewer, we're done
    if (episodes.length < 100) {
      break;
    }

    page++;
  }

  return allEpisodes;
}

export async function getShowArtworks(tvdbId: number): Promise<string | null> {
  try {
    const data = await tvdbFetch(`/series/${tvdbId}/artworks`) as {
      data?: Array<{ type: number; image: string; thumbnail?: string }>;
    };

    if (!data.data || !Array.isArray(data.data)) {
      return null;
    }

    // Type 2 is poster
    const poster = data.data.find((art) => art.type === 2);
    return poster?.image ?? null;
  } catch {
    return null;
  }
}
