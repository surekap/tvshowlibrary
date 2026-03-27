import Image from "next/image";

interface ShowPosterProps {
  posterUrl: string | null | undefined;
  name: string;
  /** Tailwind / CSS class for the wrapper div, e.g. "w-16 h-24" */
  className?: string;
  /** next/image sizes hint, e.g. "80px" */
  sizes?: string;
}

export default function ShowPoster({ posterUrl, name, className = "w-16 h-24", sizes = "80px" }: ShowPosterProps) {
  return (
    <div className={`relative flex-shrink-0 overflow-hidden rounded ${className}`}>
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={name}
          fill
          className="object-cover"
          sizes={sizes}
        />
      ) : (
        <div className="poster-placeholder w-full h-full">
          <svg
            aria-hidden="true"
            className="w-1/3 h-1/3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
