import type { ReactNode } from "react";

const URL_SEGMENTS = /(https?:\/\/[^\s<>"']+)/g;
const TRAILING_PUNCTUATION = /[),.;:!?]+$/;

/** Render plain lesson copy safely while making cited web sources usable. */
export function LinkedText({ children }: { children: string }): ReactNode {
  return children.split(URL_SEGMENTS).map((segment, index) => {
    if (!/^https?:\/\//i.test(segment)) return segment;

    const url = segment.replace(TRAILING_PUNCTUATION, "");
    const punctuation = segment.slice(url.length);
    return (
      <span key={`${index}-${url}`}>
        <a className="break-all text-primary underline underline-offset-4" href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        {punctuation}
      </span>
    );
  });
}
