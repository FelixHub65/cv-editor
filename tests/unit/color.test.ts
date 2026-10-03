import { expect, test } from "bun:test";
import { hexToHsv, hexToRgb, hsvToHex, parseHex, rgbToHex } from "../../src/ui/color";

test("color inputs normalize hex and round-trip RGB and wheel coordinates", () => {
  expect(parseHex(" #aBc ")).toBe("#aabbcc");
  expect(parseHex("FF8000")).toBe("#ff8000");
  expect(parseHex("#12345g")).toBeNull();
  expect(parseHex("#12345678")).toBeNull();
  for (const color of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#123456", "#c5cfd3"]) {
    expect(rgbToHex(hexToRgb(color))).toBe(color);
    const { h, s, v } = hexToHsv(color);
    expect(hsvToHex(h, s, v)).toBe(color);
  }
});
