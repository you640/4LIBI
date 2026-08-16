import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// S4.6.1 — Zoznam analyz pre prihlaseneho pouzivatela
export const listMyAnalyses = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return await ctx.db
      .query("analyses")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.tokenIdentifier))
      .order("desc")
      .collect();
  },
});

// S4.6.2 — Ziskaj jednu analyzu (owner check)
export const getMyAnalysis = query({
  args: { analysisId: v.id("analyses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new Error("Analýza nebola nájdená");
    if (analysis.ownerId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    return analysis;
  },
});

// Internal — vytvor analyzu (z analyze node action)
export const createAnalysis = mutation({
  args: {
    fileIds: v.array(v.id("files")),
    name: v.string(),
    data: v.any(),
    status: v.union(v.literal("analyzing"), v.literal("ready"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const now = Date.now();
    return await ctx.db.insert("analyses", {
      ownerId: identity.tokenIdentifier,
      fileIds: args.fileIds,
      name: args.name,
      data: args.data,
      status: args.status,
      errorMessage: args.errorMessage,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Internal — aktualizuj analyzu (z analyze node action)
export const updateAnalysis = mutation({
  args: {
    analysisId: v.id("analyses"),
    data: v.optional(v.any()),
    status: v.optional(v.union(v.literal("analyzing"), v.literal("ready"), v.literal("error"))),
    errorMessage: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new Error("Analýza nebola nájdená");
    if (analysis.ownerId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    const updates: any = { updatedAt: Date.now() };
    if (args.data !== undefined) updates.data = args.data;
    if (args.status !== undefined) updates.status = args.status;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.name !== undefined) updates.name = args.name;
    await ctx.db.patch(args.analysisId, updates);
    return args.analysisId;
  },
});

// S4.6.3 — Premenuj analyzu
export const renameAnalysis = mutation({
  args: { analysisId: v.id("analyses"), newName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new Error("Analýza nebola nájdená");
    if (analysis.ownerId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    await ctx.db.patch(args.analysisId, { name: args.newName, updatedAt: Date.now() });
    return args.analysisId;
  },
});

// S4.6.4 — Zmaz analyzu (owner check)
export const remove = mutation({
  args: { analysisId: v.id("analyses") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new Error("Analýza nebola nájdená");
    if (analysis.ownerId !== identity.tokenIdentifier) throw new Error("Unauthorized");
    await ctx.db.delete(args.analysisId);
    return { success: true };
  },
});
