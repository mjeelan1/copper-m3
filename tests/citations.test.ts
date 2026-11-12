// @vitest-environment node
import { describe, expect, it } from "vitest";
import { splitCitations } from "@/lib/copper/citations";

describe("splitCitations", () => {
  it("links a citation to its document's PDF at that page", () => {
    expect(
      splitCitations(
        "Unplug it for 30 seconds [Copper Home User Guide, p. 9]. Done.",
      ),
    ).toEqual([
      "Unplug it for 30 seconds ",
      {
        label: "[Copper Home User Guide, p. 9]",
        title: "Copper Home User Guide",
        page: 9,
        url: "/docs/copper-home-user-guide.pdf#page=9",
      },
      ". Done.",
    ]);
  });

  it("handles two citations in a row and small variations in how they're written", () => {
    const parts = splitCitations(
      "Refunds within 14 days [copper plus faq, page 5] [Copper State Labs Terms and Conditions, p.4].",
    );
    const urls = parts.flatMap((p) => (typeof p === "string" ? [] : [p.url]));
    expect(urls).toEqual([
      "/docs/copper-plus-faq.pdf#page=5",
      "/docs/copper-terms-and-conditions.pdf#page=4",
    ]);
    // Shown with the document's real title, whatever the case it was written in.
    expect(parts[1]).toMatchObject({ label: "[Copper Plus FAQ, p. 5]" });
  });

  it("builds the link itself, ignoring any URL the model wrote", () => {
    const [, citation] = splitCitations(
      "See [Copper Notes User Guide, p. 4](https://example.com/phish).",
    );
    expect(citation).toMatchObject({
      url: "/docs/copper-notes-user-guide.pdf#page=4",
    });
    expect(
      splitCitations(
        "See [Copper Notes User Guide, p. 4](https://example.com/phish).",
      ).join(""),
    ).not.toContain("example.com");
  });

  it("leaves text alone when it isn't a citation of one of Copper's documents", () => {
    expect(splitCitations("No citations here.")).toEqual([
      "No citations here.",
    ]);
    expect(splitCitations("See [Some Other Manual, p. 3].")).toEqual([
      "See [Some Other Manual, p. 3].",
    ]);
  });
});
