// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { DOCUMENTS } from "@/lib/copper/documents";
import { getPassages, passagesInfo } from "@/lib/copper/passages";
import { pageBody, splitPage } from "@/lib/copper/split-page";

// A page laid out like the Copper PDFs: a three-line header, then wrapped text.
const PAGE = [
  "Copper State Labs Terms and Conditions Effective January 1, 2026",
  "CSL-LGL-0001 Version 2026.1 Page 5 of 7",
  "© 2026 Copper State Labs, Inc. · Fictional company and documents, for educational use only.",
  "5. PRIVACY AND YOUR DATA",
  "5.1 Copper Home listens on the device for the wake word, and nothing at all is sent to",
  "the cloud until the wake word is detected by the speaker. Annual plans get a full refund",
  "if you cancel within",
  "14 days of purchase, which you can do at any time in the Copper app on your phone.",
  "After those 14 days, annual plans are not refunded for any reason, including moving.",
  "Your requests are kept for 30 days on the free plan and for 12 months with Copper Plus.",
  "You can view and delete any request at any time in the Copper app under Settings.",
  "6. RECORDING OTHER PEOPLE",
  "6.1 Copper Notes plays a Consent Chime and lights an amber ring every time it records.",
  "You are responsible for following the recording-consent laws wherever you use it.",
  "Some states require everyone in a conversation to agree to being recorded first.",
].join("\n");

describe("splitPage", () => {
  const passages = splitPage(PAGE);

  it("drops the page header", () => {
    expect(pageBody(PAGE)[0]).toBe("5. PRIVACY AND YOUR DATA");
    expect(passages.join(" ")).not.toMatch(/CSL-LGL|©/);
  });

  it("keeps every word, joins wrapped lines and doesn't break a sentence at a line that starts with a number", () => {
    expect(passages.join(" ")).toContain("within 14 days of purchase,");
    expect(passages.join(" ").split(/\s+/)).toHaveLength(
      pageBody(PAGE).join(" ").split(/\s+/).length,
    );
  });

  it("keeps a heading with the text after it, section number included", () => {
    expect(
      passages.some((p) => p.startsWith("6. RECORDING OTHER PEOPLE 6.1")),
    ).toBe(true);
    expect(passages.some((p) => p.endsWith("RECORDING OTHER PEOPLE"))).toBe(
      false,
    );
  });

  it("makes passages of a few sentences", () => {
    expect(passages.length).toBeGreaterThan(1);
    for (const p of passages) expect(p.length).toBeLessThanOrEqual(750);
  });

  it("keeps the last cell of a table with its table, not with the next clause", () => {
    // The refund table on page 4 of the Terms ends in a cell with no full stop.
    const table = [
      "Copper State Labs Terms and Conditions Effective January 1, 2026",
      "CSL-LGL-0001 Version 2026.1 Page 4 of 7",
      "© 2026 Copper State Labs, Inc. · Fictional company and documents, for educational use only.",
      "4.5 Cancel anytime. Cancel in the Copper app under Settings > Subscription. You keep Copper Plus until the end of the period you've paid for, and nothing more is charged after that.",
      "4.6 Refunds.",
      "Plan Refund rule",
      "Monthly Not refunded for partial months",
      "Annual Full refund if you cancel within 14 days of purchase.",
      "After 14 days, not refunded",
      "4.7 Price changes. We'll tell you at least 30 days before a price change takes effect. The new price applies from your next renewal, and you can cancel before then.",
    ].join("\n");
    const split = splitPage(table);
    expect(split.some((p) => p.endsWith("After 14 days, not refunded"))).toBe(
      true,
    );
    expect(split.some((p) => p.startsWith("4.7 Price changes."))).toBe(true);
  });
});

describe("lib/copper/data/passages.json", () => {
  const passages = getPassages();

  it("was embedded with the current embedding model and size", () => {
    expect(passagesInfo()).toMatchObject({
      model: EMBEDDING_MODEL.id,
      dimensions: EMBEDDING_MODEL.dimensions,
    });
  });

  it("has passages from every customer document", () => {
    for (const doc of DOCUMENTS)
      expect(
        passages.filter((p) => p.documentId === doc.id).length,
      ).toBeGreaterThan(0);
  });

  it("starts every passage with its document title and keeps its page", () => {
    for (const p of passages) {
      expect(p.text.startsWith(`${p.title}: `)).toBe(true);
      expect(p.page).toBeGreaterThanOrEqual(1);
      expect(DOCUMENTS.find((d) => d.id === p.documentId)?.title).toBe(p.title);
    }
  });

  it("stores one length-1 vector per passage", () => {
    for (const p of passages) {
      expect(p.embedding).toHaveLength(EMBEDDING_MODEL.dimensions);
      expect(Math.hypot(...p.embedding)).toBeCloseTo(1, 3);
    }
  });
});
