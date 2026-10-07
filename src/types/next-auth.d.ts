import type { DefaultSession } from "next-auth";

/**
 * Typi NextAuth — dopolnitev session.user.id (JWT sub) za strogi TS.
 * Brez tega useSession()/getServerSession() ne bi poznali id polja.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
  }
}
