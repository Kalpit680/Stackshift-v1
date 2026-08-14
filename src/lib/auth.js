import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { readUsersDB, writeUsersDB } from "@/lib/db";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const users = readUsersDB();
        const user = users.find(
          (u) => u.email?.toLowerCase() === credentials.email.toLowerCase()
        );

        if (user && user.password === credentials.password) {
          return {
            id: user.email,
            name: user.name,
            email: user.email,
          };
        }

        return null;
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === "google") {
        const users = readUsersDB();
        const email = user.email || profile?.email;
        const exists = users.some(
          (u) => u.email?.toLowerCase() === email?.toLowerCase()
        );
        if (!exists) {
          // Register the Google user automatically if they don't exist
          const newUser = {
            name: user.name || profile?.name || (email ? email.split('@')[0] : "Google User"),
            email: email ? email.toLowerCase() : "",
            password: "oauth-user-no-password-" + Math.random().toString(36).substring(2, 10)
          };
          users.push(newUser);
          writeUsersDB(users);
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id || token.sub;
        session.user.name = token.name;
        session.user.email = token.email;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || user.email;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "stack-shift-secret-key-32-chars-long",
};
