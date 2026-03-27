function toMetacriticSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

interface ExternalLinksProps {
  name: string;
  tmdbId?: number | null;
  imdbId?: string | null;
}

export default function ExternalLinks({ name, tmdbId, imdbId }: ExternalLinksProps) {
  const tmdbUrl = tmdbId ? `https://www.themoviedb.org/tv/${tmdbId}` : null;
  const imdbUrl = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : `https://www.imdb.com/find/?q=${encodeURIComponent(name)}&s=tt&ttype=tv`;
  const metacriticUrl = `https://www.metacritic.com/tv/${toMetacriticSlug(name)}/`;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tmdbUrl && (
        <a
          href={tmdbUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} on TMDb`}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#01b4e4" }}
        >
          TMDb
        </a>
      )}
      <a
        href={imdbUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} on IMDb`}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#f5c518", color: "#000" }}
      >
        IMDb
      </a>
      <a
        href={metacriticUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} on Metacritic`}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white transition-opacity hover:opacity-80"
        style={{ backgroundColor: "#6c3" }}
      >
        MC
      </a>
    </div>
  );
}
