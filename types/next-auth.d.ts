import type { DefaultSession } from "@auth/core/types";
import type { Role } from "@/lib/validation/enums";

// `next-auth`'s own User/Session/JWT are re-exports of these — augmenting
// "next-auth" directly doesn't reliably merge (`next-auth/jwt` re-exports
// via `export *`, which TS won't merge into), so we augment the real
// declaration site instead. @auth/core is pinned as a devDependency purely
// so this module specifier resolves under pnpm's strict node_modules.
//
// Deliberately no `extends` here: `User` already extends `DefaultUser`
// (id?: string, name?: string | null) and `JWT` already extends `DefaultJWT`
// (name?: string | null); adding a second, differently-typed `extends`
// target for the same field names trips "Interface cannot simultaneously
// extend types ... not identical" — so every field this app needs is listed
// as a plain own member instead.
declare module "@auth/core/types" {
  interface User {
    id: string;
    username: string;
    name: string;
    role: Role;
    groupId: number;
    groupPath: string;
    mustChangePassword: boolean;
  }

  interface Session {
    user: User & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    username: string;
    name: string;
    role: Role;
    groupId: number;
    groupPath: string;
    mustChangePassword: boolean;
  }
}
