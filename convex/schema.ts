import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tabuľka pre nahrané súbory (PDF, TXT, DOCX)
  files: defineTable({
    ownerId: v.string(),
    name: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    size: v.number(),
    uploadedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Tabuľka pre Sherlock analýzy (Issue #11 — S4.3)
  analyses: defineTable({
    ownerId: v.string(),
    fileIds: v.array(v.id("files")),
    name: v.string(),
    // JSON s plnou analýzou: { metadata, persons, evidence, relationships, timeline }
    data: v.any(),
    status: v.union(
      v.literal("analyzing"),
      v.literal("ready"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["ownerId", "status"]),
});
