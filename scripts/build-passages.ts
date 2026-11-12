// npm run build:passages
//
// Reads every PDF in public/docs/, splits each page into passages of a few
// sentences, embeds each passage with Gemini (callEmbed in lib/ai/call.ts) and
// writes them all to lib/copper/data/passages.json, which the app loads into
// memory when it starts (lib/copper/passages.ts, instrumentation.ts).
// Run it again whenever a PDF changes.
//
//   --dry-run   print the passages without embedding or saving them
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { callEmbed } from "@/lib/ai/call";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { DOCUMENTS } from "@/lib/copper/documents";
import type { PassagesFile } from "@/lib/copper/passages";
import { splitPage } from "@/lib/copper/split-page";

const DOCS_DIR = "public/docs";
const OUT_FILE = "lib/copper/data/passages.json";
const dryRun = process.argv.includes("--dry-run");

/** Six decimals is plenty for search and keeps the JSON file small. */
const round = (x: number) => Math.round(x * 1e6) / 1e6;

async function main() {
  const files = (await readdir(DOCS_DIR))
    .filter((f) => f.endsWith(".pdf"))
    .sort();
  if (!files.length) throw new Error(`No PDFs in ${DOCS_DIR}/`);

  const drafts: Omit<PassagesFile["passages"][number], "embedding">[] = [];
  for (const file of files) {
    const doc = DOCUMENTS.find((d) => d.file === `/docs/${file}`);
    const documentId = doc?.id ?? path.basename(file, ".pdf");
    const title = doc?.title ?? documentId;
    if (!doc)
      console.warn(
        `! ${file} isn't in lib/copper/documents.ts; using "${title}" as its title`,
      );

    const pdf = await getDocumentProxy(
      new Uint8Array(await readFile(path.join(DOCS_DIR, file))),
    );
    const { text: pages } = await extractText(pdf, { mergePages: false });
    pages.forEach((pageText, i) => {
      splitPage(pageText).forEach((body, j) => {
        drafts.push({
          id: `${documentId}-p${i + 1}-${j + 1}`,
          documentId,
          title,
          file: `/docs/${file}`,
          page: i + 1,
          text: `${title}: ${body}`,
        });
      });
    });
  }

  if (dryRun) {
    for (const p of drafts)
      console.log(`\n[${p.id}] (${p.text.length} chars)\n${p.text}`);
  } else {
    const embeddings = await callEmbed(
      { module: 3, feature: "embed-passages" },
      drafts.map((p) => p.text),
      "RETRIEVAL_DOCUMENT",
    );
    const out: PassagesFile = {
      model: EMBEDDING_MODEL.id,
      dimensions: EMBEDDING_MODEL.dimensions,
      createdAt: new Date().toISOString(),
      passages: drafts.map((p, i) => ({
        ...p,
        embedding: embeddings[i].map(round),
      })),
    };
    await writeFile(OUT_FILE, JSON.stringify(out) + "\n");
    console.log(`\nSaved ${out.passages.length} passages to ${OUT_FILE}`);
  }

  console.log("\nPassages per document:");
  for (const file of files) {
    const mine = drafts.filter((p) => p.file === `/docs/${file}`);
    const pages = new Set(mine.map((p) => p.page)).size;
    console.log(
      `  ${mine[0]?.title ?? file}: ${mine.length} passages from ${pages} pages`,
    );
  }
  console.log(`  Total: ${drafts.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
