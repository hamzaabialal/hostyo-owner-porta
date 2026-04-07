/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { Client } from "@notionhq/client";
import { createHash } from "crypto";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const USERS_DB = process.env.NOTION_USERS_DB || "";
const SECRET = process.env.NEXTAUTH_SECRET || "hostyo-default-secret-change-me";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + SECRET).digest("hex");
}

function getProp(page: any, name: string): any {
  const p = page.properties?.[name];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.[0]?.plain_text || "";
    case "rich_text": return p.rich_text?.[0]?.plain_text || "";
    case "email": return p.email || "";
    case "checkbox": return p.checkbox ?? false;
    case "unique_id": return p.unique_id?.number || 0;
    default: return null;
  }
}

const handler = NextAuth({
  providers: [
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // Email/Password — checks Notion users DB
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const passwordHash = hashPassword(credentials.password);

        // Check Notion users database
        if (USERS_DB) {
          try {
            const res = await notion.databases.query({
              database_id: USERS_DB,
              filter: { property: "Email", email: { equals: credentials.email.toLowerCase().trim() } },
              page_size: 1,
            });

            if (res.results.length > 0) {
              const user = res.results[0];
              const storedHash = getProp(user, "Password");
              const name = getProp(user, "Full Name");
              const email = getProp(user, "Email");

              if (storedHash === passwordHash) {
                const isAdmin = getProp(user, "Is Admin") === true;
                const properties = getProp(user, "Properties") || "";
                return { id: user.id, email, name, image: null, role: isAdmin ? "admin" : "owner", properties };
              }
              // Wrong password
              return null;
            }
          } catch (e) {
            console.error("Notion auth error:", e);
          }
        }

        // No user found in Notion
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || "owner";
        token.properties = (user as any).properties || "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        (session.user as any).role = token.role || "owner";
        (session.user as any).properties = token.properties || "";
      }
      return session;
    },
  },
  secret: SECRET,
});

export { handler as GET, handler as POST };
