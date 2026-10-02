# Icon workflow

Use `lucide-react` for familiar interface actions. Add a custom icon only when the product needs a metaphor Lucide does not provide.

## Figma specification

- Draw each icon in a 24×24 frame with no background.
- Use a 2px stroke, round caps, and round joins for outline icons.
- Use one paint color. The generator converts that color to `currentColor`.
- Align important edges to whole or half pixels and inspect the result at 16, 18, 20, and 24px.
- Name the exported file in lowercase kebab-case, for example `tailored-cv.svg`.
- Export plain SVG. Avoid raster images, masks, filters, gradients, and inline styles.

## Add an icon

1. Export the Figma frame into `src/ui/icons/source`.
2. Run `bun run icons:generate`.
3. Inspect `/icon-gallery` while `bun run dev` is running.
4. Import the generated icon directly from `@/ui/icons`.

```tsx
import { DocumentSparklesIcon } from "@/ui/icons";

<DocumentSparklesIcon size={18} />
<DocumentSparklesIcon size={24} color="var(--color-app-accent)" />
```

Generated icons inherit `currentColor`, accept `size`, `strokeWidth`, `className`, and standard SVG props. They are decorative by default. Pass `title` only when an icon appears without adjacent accessible text; buttons should continue to supply their own `aria-label`.

Commit the source SVG and regenerated TypeScript files together. Do not edit files in `generated`, `catalog.ts`, or `index.ts` by hand.

## Performance rules

- Import named icons rather than the complete Lucide namespace.
- Keep runtime icon-name registries limited to known icons. The gallery catalog intentionally imports every custom icon, but production features should not use it.
- Render interface icons as inline SVG, not through `next/image`.
- Prefer CSS color inheritance over separate colored copies of an icon.
