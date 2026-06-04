export function FloatingDecor() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-emerald-200/25 dark:bg-emerald-500/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/4 -right-20 h-80 w-80 rounded-full bg-violet-200/20 dark:bg-violet-500/10 blur-3xl animate-pulse [animation-delay:-5s]" />
        <div className="absolute -bottom-28 left-1/4 h-96 w-96 rounded-full bg-amber-200/15 dark:bg-amber-500/8 blur-3xl animate-pulse [animation-delay:-10s]" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 rounded-full bg-rose-200/10 dark:bg-rose-500/5 blur-3xl animate-pulse [animation-delay:-3s]" />
        <div className="absolute top-10 left-2/3 h-48 w-48 rounded-full bg-cyan-200/10 dark:bg-cyan-500/5 blur-3xl animate-pulse [animation-delay:-1.5s]" />
        <div className="absolute bottom-1/3 right-1/4 h-56 w-56 rounded-full bg-teal-200/10 dark:bg-teal-500/5 blur-3xl animate-pulse [animation-delay:-4s]" />
        </div>
    );
}
