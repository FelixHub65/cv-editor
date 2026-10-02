import { plain } from "../../src/domain/cv";
import { createFixture } from "../../src/domain/fixture";

export function legacyDraft() {
  return {
    schemaVersion: 1,
    cv: { id: "cv-alex-morgan", name: "Alex Morgan", section: {
      id: "section-experience", title: "Experience", entry: {
        id: "entry-northstar", title: "Frontend Engineer · Northstar Studio",
        blocks: [
          { id: "block-components", type: "bullet" as const, spans: plain("Built reusable interface components.") },
          { id: "block-designers", type: "bullet" as const, spans: [{ text: "My existing draft edit.", bold: true, italic: false }] },
        ],
      },
    } },
    proposal: createFixture().proposal,
  };
}
