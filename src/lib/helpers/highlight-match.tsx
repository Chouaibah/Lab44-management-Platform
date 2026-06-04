'use client';

export function HighlightMatch({ text, query }: { text: string; query: string }) {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
        {text.slice(0, idx)}
        <mark className="bg-emerald-200 dark:bg-emerald-800 text-inherit rounded px-0.5">
        {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
        </>
    );
}
