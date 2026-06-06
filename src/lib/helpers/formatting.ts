export function fmtDate(d: string) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return d;
    }
}

export function fmtDateTime(d: string) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return d;
    }
}

export function getInitials(firstName: string, lastName: string): string {
    return `${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').toUpperCase()}`;
}

export function getAvatarColor(name: string): string {
    const colors = [
        'bg-emerald-600',
        'bg-violet-600',
        'bg-amber-600',
        'bg-rose-600',
        'bg-cyan-600',
        'bg-orange-600',
        'bg-teal-600',
        'bg-fuchsia-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export function todayDateStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
