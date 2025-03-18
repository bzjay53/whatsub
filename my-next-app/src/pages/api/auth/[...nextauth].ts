import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error("이메일이 필요합니다.");
        }

        // 현재는 이메일만으로 사용자를 찾습니다 (나중에 비밀번호 검증 추가 예정)
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            subscription: true,
            usage: true,
          },
        });

        if (!user) {
          throw new Error("사용자를 찾을 수 없습니다.");
        }

        // 사용자 정보 반환
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscription: user.subscription,
          usage: user.usage,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.subscription = user.subscription;
        token.usage = user.usage;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.subscription = token.subscription;
        session.user.usage = token.usage;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions); 