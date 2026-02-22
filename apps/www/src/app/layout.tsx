import "@acme/ui/globals.css";
// import "@/styles/globals.css";

import { TailwindIndicator } from "@/components/tailwind-indicator";

import { env } from "@/env.mjs";

// import { ReactQueryProvider } from "@/providers/react-query";
import { SpeedInsights } from "@vercel/speed-insights/next";

// import { Provider as Analytics } from "@acme/events/client";
import { Toaster as MiddayToast, Toaster } from "@acme/ui/toaster";

import { Providers } from "./providers";
import { Suspense } from "react";
import { StaticTrpc } from "@/components/static-trpc";
import { constructMetadata } from "@/lib/construct-metadata";

export async function generateMetadata({}) {
    return constructMetadata({
        title: `Al-Ghurobaa - gndprodesk.com`,
    });
}
// const inter = Inter({ subsets: ["latin"] });
export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <SpeedInsights />
            <body>
                <div className="print:hidden">
                    <Toaster />
                    <MiddayToast />
                    <Suspense>
                        <Providers>
                            <StaticTrpc />
                            {children}
                        </Providers>
                    </Suspense>

                    {/* <Analytics /> */}
                    <TailwindIndicator />
                </div>
            </body>
        </html>
    );
}
