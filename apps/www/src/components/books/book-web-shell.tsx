import Link from "next/link";

export function BookWebShell({
    children,
    title,
    eyebrow,
    actions,
}: {
    children: React.ReactNode;
    title: string;
    eyebrow?: string;
    actions?: React.ReactNode;
}) {
    return (
        <main className="min-h-screen bg-[#f4f0e8] text-[#241f19]">
            <header className="sticky top-0 z-20 border-b border-[#d8d0c2] bg-[#f9f6ef]/95 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-4 lg:px-8">
                    <Link
                        href="/books"
                        className="rounded-full bg-[#173f35] px-4 py-2 text-sm font-bold text-white"
                    >
                        المكتبة
                    </Link>
                    <div className="min-w-0 flex-1 text-right" dir="rtl">
                        {eyebrow ? (
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#84786a]">
                                {eyebrow}
                            </p>
                        ) : null}
                        <h1 className="truncate text-xl font-black lg:text-2xl">
                            {title}
                        </h1>
                    </div>
                    {actions}
                </div>
            </header>
            {children}
        </main>
    );
}
