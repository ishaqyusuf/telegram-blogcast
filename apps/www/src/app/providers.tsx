"use client";

import { ThemeProvider } from "@/providers/theme-provider";

import { TRPCReactProvider } from "@/trpc/client";
import { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

type Props = {
    children: ReactNode;
};
export function Providers({ children }: Props) {
    return (
        <NuqsAdapter>
            <TRPCReactProvider>
                <ThemeProvider attribute="class" defaultTheme="light">
                    {children}
                </ThemeProvider>
            </TRPCReactProvider>
        </NuqsAdapter>
    );
}
