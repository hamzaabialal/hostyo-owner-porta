import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { readFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password + process.env.NEXTAUTH_SECRET).digest("hex");
}

async function getUsers() {
  try {
    const data = await readFile(path.join(process.cwd(), "data", "users.json"), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
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

    // Email/Password
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Check registered users first
        const users = await getUsers();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = users.find((u: any) => u.email.toLowerCase() === credentials.email.toLowerCase());

        if (user && user.passwordHash === hashPassword(credentials.password)) {
          return { id: user.id, email: user.email, name: user.name, image: null };
        }

        // Fallback demo: accept any email with "hostyo123"
        if (credentials.password === "hostyo123") {
          const name = credentials.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return { id: credentials.email, email: credentials.email, name, image: null };
        }

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
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
