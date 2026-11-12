// The customer documents (public/docs/*.pdf), split into passages of a few
// sentences and embedded with Gemini by `npm run build:passages`. The app
// loads them into memory once when the server starts (instrumentation.ts), so
// searching them never reads the disk or calls the model for the documents.
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

/** Which model and size the embeddings were made with. */
export function passagesInfo() {
  return {
    model: file.model,
    dimensions: file.dimensions,
    createdAt: file.createdAt,
    count: file.passages.length,
  };
}
