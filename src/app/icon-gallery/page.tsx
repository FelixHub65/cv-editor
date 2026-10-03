import { notFound } from "next/navigation";
import {
  AlignLeft, ArrowLeft, Bold, Box, CaseUpper, ChevronLeft,
  ChevronRight, Circle, CircleDot, Columns2, Dot, FilePlus2, Files, FileText,
  GapHorizontal, GapVertical, Heading, Italic, LayoutPanelTop, List,
  ListIndentIncrease, ListTree, Maximize2, Minus, Pilcrow, Plus,
  RectangleEllipsis, Redo2, Rows3, Save, ScrollText, Section, SquareText,
  Type, Undo2, type LucideIcon,
} from "lucide-react";
import { customIconCatalog } from "@/ui/icons/catalog";
import type { IconProps } from "@/ui/icons/icon-types";
import styles from "./icon-gallery.module.css";

const lucideCatalog: { name: string; Icon: LucideIcon }[] = [
  { name: "arrow-left", Icon: ArrowLeft },
  { name: "bold", Icon: Bold },
  { name: "chevron-left", Icon: ChevronLeft },
  { name: "chevron-right", Icon: ChevronRight },
  { name: "columns-2", Icon: Columns2 },
  { name: "file-plus-2", Icon: FilePlus2 },
  { name: "gap-horizontal", Icon: GapHorizontal },
  { name: "gap-vertical", Icon: GapVertical },
  { name: "italic", Icon: Italic },
  { name: "list", Icon: List },
  { name: "maximize-2", Icon: Maximize2 },
  { name: "minus", Icon: Minus },
  { name: "plus", Icon: Plus },
  { name: "redo-2", Icon: Redo2 },
  { name: "save", Icon: Save },
  { name: "undo-2", Icon: Undo2 },
];

const elementSuggestions: {
  element: string;
  description: string;
  options: { name: string; Icon: LucideIcon; recommended?: boolean }[];
}[] = [
  {
    element: "Document",
    description: "The complete CV root.",
    options: [
      { name: "FileText", Icon: FileText, recommended: true },
      { name: "ScrollText", Icon: ScrollText },
      { name: "Files", Icon: Files },
    ],
  },
  {
    element: "Section",
    description: "A major CV group such as Experience or Education.",
    options: [
      { name: "SquareText", Icon: SquareText, recommended: true },
      { name: "Section", Icon: Section },
      { name: "LayoutPanelTop", Icon: LayoutPanelTop },
    ],
  },
  {
    element: "Entry",
    description: "A grouped item inside a section, such as one role.",
    options: [
      { name: "RectangleEllipsis", Icon: RectangleEllipsis, recommended: true },
      { name: "Rows3", Icon: Rows3 },
      { name: "Box", Icon: Box },
    ],
  },
  {
    element: "Heading",
    description: "Any level of editable heading text.",
    options: [
      { name: "Heading", Icon: Heading, recommended: true },
      { name: "Type", Icon: Type },
      { name: "CaseUpper", Icon: CaseUpper },
    ],
  },
  {
    element: "Text",
    description: "A normal paragraph or unlisted text block.",
    options: [
      { name: "Type", Icon: Type, recommended: true },
      { name: "Pilcrow", Icon: Pilcrow },
      { name: "AlignLeft", Icon: AlignLeft },
    ],
  },
  {
    element: "List",
    description: "The container that owns a group of bullets.",
    options: [
      { name: "List", Icon: List, recommended: true },
      { name: "ListTree", Icon: ListTree },
      { name: "ListIndentIncrease", Icon: ListIndentIncrease },
    ],
  },
  {
    element: "Bullet",
    description: "One individual item within a list.",
    options: [
      { name: "Dot", Icon: Dot, recommended: true },
      { name: "CircleDot", Icon: CircleDot },
      { name: "Circle", Icon: Circle },
    ],
  },
];

type GalleryIcon = (props: IconProps) => React.ReactNode;

function IconGrid({ icons }: { icons: readonly { name: string; Icon: GalleryIcon }[] }) {
  return <div className={styles.grid}>
    {icons.map(({ name, Icon }) => <article className={styles.card} key={name}>
      <div className={styles.preview} aria-label={`${name} at 16, 20, and 24 pixels`}>
        <Icon size={16} aria-hidden="true" />
        <Icon size={20} aria-hidden="true" />
        <Icon size={24} aria-hidden="true" />
      </div>
      <p className={styles.name}>{name}</p>
    </article>)}
  </div>;
}

export default function IconGalleryPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const StateIcon = customIconCatalog[0].Icon;
  return <main className={styles.shell}>
    <header className={styles.header}>
      <p className="eyebrow">Development tool</p>
      <h1>Icon gallery</h1>
      <p>Review optical weight, alignment, inherited color, and small-size legibility before using an icon in the product.</p>
    </header>
    <section className={styles.section}>
      <h2>CV element icon system</h2>
      <p className={styles.sectionIntro}>Your selected icons are highlighted and now used throughout the editor. Alternatives remain here for quick visual comparison.</p>
      <div className={styles.suggestionGrid}>
        {elementSuggestions.map((suggestion) => <article className={styles.suggestionCard} key={suggestion.element}>
          <div className={styles.suggestionHeading}>
            <div><h3>{suggestion.element}</h3><p>{suggestion.description}</p></div>
            <span>CV element</span>
          </div>
          <div className={styles.options}>
            {suggestion.options.map(({ name, Icon, recommended }) => <div className={`${styles.option} ${recommended ? styles.recommended : ""}`} key={name}>
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>{name}</span>
              {recommended && <small>Recommended</small>}
            </div>)}
          </div>
        </article>)}
      </div>
    </section>
    <section className={styles.section}>
      <h2>Custom Figma icons</h2>
      <IconGrid icons={customIconCatalog} />
      <div className={styles.states} aria-label="Custom icon color states">
        <span><StateIcon size={20} />Default</span>
        <span className={styles.muted}><StateIcon size={20} />Muted</span>
        <span className={styles.accent}><StateIcon size={20} />Accent</span>
        <span className={styles.warning}><StateIcon size={20} />Warning</span>
        <span className={styles.disabled}><StateIcon size={20} />Disabled</span>
      </div>
    </section>
    <section className={styles.section}>
      <h2>Selected Lucide interface icons</h2>
      <IconGrid icons={lucideCatalog} />
    </section>
  </main>;
}
