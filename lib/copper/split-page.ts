// Splits one PDF page's text into passages of a few sentences, for embedding
// (scripts/build-passages.ts). Pure text in, text out, so it's easy to test.

/** At most this many sentences in a passage... */
const MAX_SENTENCES = 4;
/** ...and at most about this many characters. */
const MAX_CHARS = 600;
/** A passage shorter than this joins its neighbor, when there's room. */
const MIN_CHARS = 150;
/** How long a passage may grow when a short one joins it. */
const MERGED_MAX_CHARS = 750;

/**
 * A line that starts something new instead of continuing the line above:
 * a numbered heading or clause ("5.1 Light ring", "4.3 Free trial.", "1 Place
 * Copper Notes..."), a FAQ question ("Q How much...") or a bullet. The capital
 * after the number keeps a wrapped line like "14 days of purchase." attached
 * to the sentence it continues.
 */
const STARTS_BLOCK = /^(\d+(\.\d+)*\.?\s+[A-Z]|Q\s|•\s)/;

/**
 * Where one sentence ends and the next begins: after . ! or ?, but not after
 * a section number like the "6." in "6. RECORDING OTHER PEOPLE".
 */
const SENTENCE_END =
  /(?<=[.!?])(?<!(?:^|\s)\d+(?:\.\d+)*\.)\s+(?=["“(]?[A-Z0-9•])/;

/**
 * Text that introduces what follows, so it belongs with it: a title (no full
 * stop), a question, or a clause title like "4.1 Price.".
 */
const isHeading = (text: string) =>
  !/[.!"”)]$/.test(text) || /^\d+(\.\d+)*\.?\s+[^.!?]{1,40}\.$/.test(text);

/**
 * The page's text without its header. Every page of the Copper documents
 * starts with a running title, the document code and a copyright line.
 */
export function pageBody(raw: string): string[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const copyright = lines.findIndex((line) => line.startsWith("©"));
  return copyright >= 0 && copyright < 4 ? lines.slice(copyright + 1) : lines;
}

/** Joins wrapped lines into blocks: a heading, clause or question plus what follows it. */
function blocks(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const last = out.length - 1;
    if (last < 0 || STARTS_BLOCK.test(line)) out.push(line);
    else if (out[last].endsWith("-") && /^[a-z]/.test(line))
      out[last] += line; // a word split across lines: "smart-" + "home"
    else out[last] += ` ${line}`;
  }
  return out;
}

const sentences = (block: string) =>
  block.split(SENTENCE_END).filter((s) => s.trim());

/** Joins a passage shorter than MIN_CHARS to its neighbor when they fit together. */
function joinShort(passages: string[]): string[] {
  const out = passages.reduce<string[]>((acc, passage) => {
    const previous = acc.at(-1);
    if (
      previous !== undefined &&
      passage.length < MIN_CHARS &&
      previous.length + passage.length < MERGED_MAX_CHARS
    )
      acc[acc.length - 1] = `${previous} ${passage}`;
    else acc.push(passage);
    return acc;
  }, []);
  // The first passage has nothing before it, so it joins the one after.
  if (
    out.length > 1 &&
    out[0].length < MIN_CHARS &&
    out[0].length + out[1].length < MERGED_MAX_CHARS
  )
    out.splice(0, 2, `${out[0]} ${out[1]}`);
  return out;
}

/**
 * The page's passages, each a few sentences long. Small blocks are packed
 * together, a long block is cut between sentences, and a heading or question
 * always stays with the text after it.
 */
export function splitPage(raw: string): string[] {
  const passages: string[] = [];
  let current: string[] = [];
  const fits = (more: string[]) =>
    current.length + more.length <= MAX_SENTENCES &&
    [...current, ...more].join(" ").length <= MAX_CHARS;
  /** Ends the passage, keeping any headings at its end for the next one. */
  const startNew = () => {
    const carried: string[] = [];
    while (current.length && isHeading(current.at(-1)!))
      carried.unshift(current.pop()!);
    if (current.length) passages.push(current.join(" "));
    current = carried;
  };

  for (const block of blocks(pageBody(raw))) {
    const parts = sentences(block);
    if (fits(parts)) {
      current.push(...parts);
      continue;
    }
    startNew();
    for (const sentence of parts) {
      if (!fits([sentence]) && !current.every(isHeading)) startNew();
      current.push(sentence);
    }
  }
  if (current.length) passages.push(current.join(" "));
  return joinShort(passages);
}
