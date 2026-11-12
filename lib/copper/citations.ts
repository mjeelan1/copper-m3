// Finds Copper's citations, like "[Copper Home User Guide, p. 9]", in a reply
// so the chat panel can turn each one into a link that opens the PDF at that
// page. The link comes from lib/copper/documents.ts, never from the model, so
// a citation can only point at one of Copper's own documents.
import { DOCUMENTS } from "@/lib/copper/documents";

export type Citation = {
  /** The citation as shown, like "[Copper Home User Guide, p. 9]". */
  label: string;
  title: string;
  page: number;
  /** Opens the PDF at the page, like "/docs/copper-home-user-guide.pdf#page=9". */
  url: string;
};

/**
 * "[Title, p. 9]", also "[Title, page 9]" or "[Title, p.9]". A markdown link
 * the model adds after it, "(...)", is dropped: the link is built here.
 */
const CITATION = /\[([^[\]]+?),\s*(?:p\.|page)\s*(\d+)\](?:\([^)\s]*\))?/gi;

/** The reply split into plain text and citations, in order. */
export function splitCitations(reply: string): (string | Citation)[] {
  const parts: (string | Citation)[] = [];
  let last = 0;
  for (const match of reply.matchAll(CITATION)) {
    const [whole, rawTitle, rawPage] = match;
    const doc = DOCUMENTS.find(
      (d) => d.title.toLowerCase() === rawTitle.trim().toLowerCase(),
    );
    const page = Number(rawPage);
    if (!doc || page < 1) continue; // not one of ours: leave it as text
    if (match.index > last) parts.push(reply.slice(last, match.index));
    parts.push({
      label: `[${doc.title}, p. ${page}]`,
      title: doc.title,
      page,
      url: `${doc.file}#page=${page}`,
    });
    last = match.index + whole.length;
  }
  if (last < reply.length) parts.push(reply.slice(last));
  return parts;
}
