import { Columns2, Dot, FileText, Heading, List, PanelLeft, PanelTop, RectangleEllipsis, SquareText, Type, type LucideProps } from "lucide-react";

export type ElementType = "document" | "cv-header" | "cv-columns" | "cv-column" | "cv-section" | "cv-entry" | "cv-heading" | "cv-paragraph" | "cv-list" | "cv-bullet";

export const elementTypeLabels: Record<ElementType, string> = {
  document: "Document",
  "cv-header": "Header",
  "cv-columns": "Columns",
  "cv-column": "Column",
  "cv-section": "Section",
  "cv-entry": "Entry",
  "cv-heading": "Heading",
  "cv-paragraph": "Text",
  "cv-list": "List",
  "cv-bullet": "Bullet",
};

const elementTypeIcons = {
  document: FileText,
  "cv-header": PanelTop,
  "cv-columns": Columns2,
  "cv-column": PanelLeft,
  "cv-section": SquareText,
  "cv-entry": RectangleEllipsis,
  "cv-heading": Heading,
  "cv-paragraph": Type,
  "cv-list": List,
  "cv-bullet": Dot,
} satisfies Record<ElementType, typeof FileText>;

export function isElementType(value: string): value is ElementType {
  return value in elementTypeIcons;
}

export function ElementTypeIcon({ type, ...props }: LucideProps & { type: ElementType }) {
  const Icon = elementTypeIcons[type];
  return <Icon aria-hidden="true" {...props} />;
}
