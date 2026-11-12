// The customer documents (public/docs/*.pdf), split into passages of a few
// sentences and embedded with Gemini by `npm run build:passages`. The app
// loads them into memory once when the server starts (instrumentation.ts), so
// searching them never reads the disk or calls the model for the documents.
import { callEmbed } from "@/lib/ai/call";
import data from "./data/passages.json";

export type Passage = {
  /** Document id, page and position, like "copper-home-user-guide-p6-2". */
  id: string;
  documentId: string;
  /** The document's title, as in lib/copper/documents.ts. */
  title: string;
  /** Where the PDF is served, like "/docs/copper-home-user-guide.pdf". */
  file: string;
  /** The page the passage is on, counting from 1. */
  page: number;
  /** The passage, starting with the document's title. */
  text: string;
  /** Its embedding: a vector of length 1, so a dot product is cosine similarity. */
  embedding: number[];
};

export type PassagesFile = {
  /** The embedding model that made the vectors; search queries must use it too. */
  model: string;
  dimensions: number;
  createdAt: string;
  passages: Passage[];
};

const file = data as PassagesFile;

/** Every passage, in document and page order. */
export function getPassages(): Passage[] {
  return file.passages;
}

/** One search result: a passage, where it's from, and how close it is. */
export type DocMatch = {
  id: string;
  title: string;
  page: number;
  /** Opens the PDF at the passage's page, like "/docs/copper-plus-faq.pdf#page=5". */
  url: string;
  /** The passage without the document title it starts with. */
  text: string;
  /** Cosine similarity to the question: closer to 1 is a closer match. */
  score: number;
};

const dot = (a: number[], b: number[]) =>
  a.reduce((sum, x, i) => sum + x * b[i], 0);

/** The `count` passages closest to an already-embedded question, closest first. */
export function rankPassages(
  queryVector: number[],
  count: number,
  passages: Passage[] = file.passages,
): DocMatch[] {
  return passages
    .map((passage) => ({ passage, score: dot(passage.embedding, queryVector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ passage, score }) => ({
      id: passage.id,
      title: passage.title,
      page: passage.page,
      url: `${passage.file}#page=${passage.page}`,
      text: passage.text.startsWith(`${passage.title}: `)
        ? passage.text.slice(passage.title.length + 2)
        : passage.text,
      score: Math.round(score * 1000) / 1000,
    }));
}

/**
 * Searches the documents: embeds the question (the same model as the
 * passages, as a query) and returns the `count` closest passages.
 */
export async function searchPassages(
  question: string,
  count = 5,
): Promise<DocMatch[]> {
  const [queryVector] = await callEmbed(
    { module: 3, feature: "search-docs" },
    [question],
    "RETRIEVAL_QUERY",
  );
  return rankPassages(queryVector, count);
}

/** Which model and size the embeddings were made with. */
export function passagesInfo() {
  return {
    model: file.model,
    dimensions: file.dimensions,
    createdAt: file.createdAt,
    count: file.passages.length,
  };
}
