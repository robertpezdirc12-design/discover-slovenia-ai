import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

/**
 * AUTH OPTIONS — NextAuth v4 (JWT strategija, BREZ Account/Session tabel —
 * kanon mostovne rekonstrukcije 48-a: credentials prijava, noben zunanji
 * IdP). Gesla so scrypt-hash (src/lib/password.ts).
 */

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dni
  },
  providers: [
    CredentialsProvider({
      name: "e-pošta in geslo",
      credentials: {
        email: { label: "E-pošta", type: "email" },
        password: { label: "Geslo", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;
        try {
          const user = await db.user.findUnique({ where: { email } });
          if (!user) return null;
          if (!verifyPassword(password, user.passwordHash)) return null;
          return { id: user.id, name: user.name, email: user.email };
        } catch {
          // Baza nedosegljiva — prijava fail-closed (nikoli lažnega uspeha).
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },
  pages: {
    // Prijava živi na obstoječi strani (SL-only prevzet kanon).
    signIn: "/prijava",
  },
};
