type UserIdentityStore = {
  user: {
    upsert(args: {
      where: { id: string };
      update: Record<string, never>;
      create: { id: string; email: string };
    }): Promise<unknown>;
  };
};

/** Ensure that an authenticated principal can be referenced by owner-scoped rows. */
export async function ensureUserIdentity(
  store: UserIdentityStore,
  ownerId: string,
  email: string
): Promise<void> {
  await store.user.upsert({
    where: { id: ownerId },
    update: {},
    create: { id: ownerId, email },
  });
}
