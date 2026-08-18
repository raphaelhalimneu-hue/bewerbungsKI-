/**
 * In-memory stand-in for the drizzle `db` used by the routes.
 *
 * The routes only ever operate on the current user's documents, and each test
 * controls the store contents, so the fake ignores WHERE clauses:
 * - select().from(documentsTable)...  resolves to all docs in the store
 * - insert().values(v).returning()    appends a doc and returns it
 * - update()/delete()                 resolve without effect (not under test)
 */
import { randomUUID } from "crypto";

export type FakeDoc = Record<string, any>;

export const store: { docs: FakeDoc[]; profile: Record<string, any> } = {
  docs: [],
  // Downloads are purchase-gated — default to a paying profile so the
  // download regression tests exercise the happy path.
  profile: { userId: "user-1", isPremium: true, credits: 0, emailVerifiedAt: new Date() },
};

export function resetStore() {
  store.docs = [];
  store.profile = { userId: "user-1", isPremium: true, credits: 0, emailVerifiedAt: new Date() };
}

export function seedDoc(doc: Partial<FakeDoc>): FakeDoc {
  const full = {
    id: randomUUID(),
    userId: "user-1",
    name: "Dokument",
    template: "modern",
    profileData: {},
    cvHtml: null,
    coverLetter: null,
    jobTitle: null,
    jobCompany: null,
    createdAt: new Date(),
    ...doc,
  };
  store.docs.push(full);
  return full;
}

function thenable(resolve: () => any) {
  const chain: any = {};
  for (const m of ["from", "where", "orderBy", "limit", "set", "values"]) {
    chain[m] = () => chain;
  }
  chain.returning = () => Promise.resolve(resolve());
  chain.then = (onOk: any, onErr: any) => Promise.resolve(resolve()).then(onOk, onErr);
  return chain;
}

export const fakeDb = {
  select: (..._args: any[]) => {
    const chain = thenable(() => store.docs);
    const origFrom = chain.from;
    chain.from = (table: any) => {
      if (table === fakeTables.profilesTable) return thenable(() => [store.profile]);
      return origFrom(table);
    };
    return chain;
  },
  insert: (_table: any) => {
    const chain: any = {};
    chain.values = (v: any) => ({
      returning: () => {
        const doc = seedDoc(v);
        return Promise.resolve([doc]);
      },
      then: (onOk: any, onErr: any) => Promise.resolve([seedDoc(v)]).then(onOk, onErr),
    });
    return chain;
  },
  update: (_table: any) => thenable(() => []),
  delete: (_table: any) => thenable(() => []),
};

// Minimal column objects — routes pass these into eq()/sql`` but the fake never evaluates them.
function fakeTable(name: string) {
  return new Proxy(
    {},
    { get: (_t, prop) => ({ name: String(prop), table: name }) },
  ) as any;
}

export const fakeTables = {
  documentsTable: fakeTable("documents"),
  profilesTable: fakeTable("profiles"),
};
