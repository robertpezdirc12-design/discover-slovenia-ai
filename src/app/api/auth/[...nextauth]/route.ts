import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

/**
 * /api/auth/* — NextAuth v4 (JWT, credentials; brez adapterja/baznih
 * sej). Vse roke (signin, callback, session, csrf …) poskrbi NextAuth.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
