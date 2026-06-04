import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { id } = await params;
        const levelId = parseInt(id);

        if (isNaN(levelId)) {
            return NextResponse.json({ error: 'Invalid level ID' }, { status: 400 });
        }

        const level = await db.level.findUnique({ where: { id: levelId } });
        if (!level) {
            return NextResponse.json({ error: 'Level not found' }, { status: 404 });
        }

        await db.level.delete({ where: { id: levelId } });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('DELETE /api/levels error:', error);
        return NextResponse.json({ error: 'Failed to delete level' }, { status: 500 });
    }
}
