import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.email = profile.email;
        token.name  = profile.name;
        token.picture = profile.picture;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.email   = token.email;
      session.user.name    = token.name;
      session.user.image   = token.picture;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
