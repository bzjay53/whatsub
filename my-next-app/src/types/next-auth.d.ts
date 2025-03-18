import NextAuth, { DefaultSession } from "next-auth";
import { Subscription, Usage } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      subscription: Subscription | null;
      usage: Usage | null;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    role: string;
    subscription: Subscription | null;
    usage: Usage | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    subscription: Subscription | null;
    usage: Usage | null;
  }
} 