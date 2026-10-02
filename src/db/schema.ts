import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Draft } from "@/domain/cv";
import type { WorkspaceState } from "@/persistence/workspace-store";

export const documentKind = pgEnum("document_kind", ["master", "application"]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("companies_owner_name_unique").on(table.ownerId, table.normalizedName),
]);

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  jobDescription: text("job_description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("applications_owner_updated_idx").on(table.ownerId, table.updatedAt),
  index("applications_company_idx").on(table.companyId),
]);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  contentId: text("content_id").notNull(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }),
  kind: documentKind("kind").notNull().default("master"),
  title: text("title").notNull(),
  content: jsonb("content").$type<WorkspaceState>().notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("documents_owner_updated_idx").on(table.ownerId, table.updatedAt),
  index("documents_owner_kind_idx").on(table.ownerId, table.kind),
  uniqueIndex("documents_application_unique").on(table.applicationId),
  uniqueIndex("documents_master_owner_unique").on(table.ownerId).where(sql`kind = 'master'`),
]);

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  content: jsonb("content").$type<Draft>().notNull(),
  sourceRevision: integer("source_revision").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("document_versions_document_created_idx").on(table.documentId, table.createdAt),
]);
