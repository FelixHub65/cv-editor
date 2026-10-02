import { describe, expect, test } from "bun:test";
import { iconComponentName, prepareSvgSource } from "../../scripts/generate-icons";

const icon = (paint = "#111111") => `<svg viewBox="0 0 24 24" fill="none"><path d="M2 2h20" stroke="${paint}" /></svg>`;

describe("custom icon pipeline", () => {
  test("normalizes a Figma paint to currentColor", () => {
    expect(prepareSvgSource("tailored-cv.svg", icon())).toContain('stroke="currentColor"');
    expect(iconComponentName("tailored-cv.svg")).toBe("TailoredCvIcon");
  });

  test("rejects exports outside the icon contract", () => {
    expect(() => prepareSvgSource("Tailored CV.svg", icon())).toThrow("lowercase kebab-case");
    expect(() => prepareSvgSource("tailored-cv.svg", icon().replace("24 24", "32 32"))).toThrow('viewBox="0 0 24 24"');
    expect(() => prepareSvgSource("tailored-cv.svg", icon().replace("</svg>", '<circle fill="#fff" /></svg>'))).toThrow("multiple colors");
    expect(() => prepareSvgSource("tailored-cv.svg", icon().replace("</svg>", "<filter /></svg>"))).toThrow("<filter>");
  });
});
