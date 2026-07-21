import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ClearSubscription — Find forgotten subscriptions", template: "%s · ClearSubscription" },
  description: "Find and confirm recurring subscriptions hiding in your Gmail inbox.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
