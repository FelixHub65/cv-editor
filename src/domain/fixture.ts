import { type Block, type Draft, plain } from "./cv";

export function createFixture(): Draft {
  const first: Block = { id: "block-components", type: "bullet", spans: plain("Built reusable interface components.") };
  return {
    schemaVersion: 2,
    cv: { id: "cv-alex-morgan", children: [
      { id: "cv-name", type: "heading", level: 1, spans: plain("Alex Morgan") },
      { id: "cv-role", type: "paragraph", spans: plain("Frontend Engineer") },
      { id: "cv-contact", type: "paragraph", spans: plain("Berlin, Germany · alex@example.com") },
      { id: "section-summary", type: "section", children: [
        { id: "heading-summary", type: "heading", level: 2, spans: plain("Profile") },
        { id: "block-summary", type: "paragraph", spans: plain("Frontend engineer focused on accessible, thoughtfully designed interfaces.") },
      ] },
      { id: "section-experience", type: "section", children: [
        { id: "heading-experience", type: "heading", level: 2, spans: plain("Experience") },
        { id: "entry-northstar", type: "entry", children: [
          { id: "heading-northstar", type: "heading", level: 3, spans: plain("Frontend Engineer · Northstar Studio") },
          { id: "dates-northstar", type: "paragraph", spans: plain("2022–Present · Berlin") },
          { id: "list-northstar", type: "list", children: [first, { id: "block-designers", type: "bullet", spans: plain("Worked with designers to improve product interfaces.") }] },
        ] },
      ] },
      { id: "section-education", type: "section", children: [
        { id: "heading-education", type: "heading", level: 2, spans: plain("Education") },
        { id: "entry-education", type: "entry", children: [
          { id: "heading-degree", type: "heading", level: 3, spans: plain("BSc Computer Science · Example University") },
          { id: "dates-degree", type: "paragraph", spans: plain("2018–2022") },
        ] },
      ] },
    ] },
    proposal: {
      id: "proposal-accessibility", targetId: first.id, expected: structuredClone(first),
      replacement: plain("Built reusable interface components with keyboard navigation and visible focus states."),
      reason: "Make the supported accessibility work more specific.",
      evidence: { id: "answer-accessibility", source: "Fixture interview · Answer 1", text: "I implemented keyboard navigation and visible focus states in our shared components." },
      status: "pending",
    },
  };
}
