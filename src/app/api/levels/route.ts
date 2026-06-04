import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/levels - list all levels
export async function GET() {
    try {
        const levels = await db.level.findMany({
            orderBy: { createdAt: 'asc' },
        });
        // Return with a combined label for convenience
        const result = levels.map((l) => ({
            id: l.id,
            year: l.year,
            specialty: l.specialty,
            label: `${l.year} - ${l.specialty}`,
        }));
        return NextResponse.json(result);
    } catch (error) {
        console.error('GET /api/levels error:', error);
        return NextResponse.json({ error: 'Failed to fetch levels' }, { status: 500 });
    }
}

// POST /api/levels - create a new level (admin only)
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { year, specialty } = await request.json();

        if (!year || !specialty) {
            return NextResponse.json({ error: 'Year and specialty are required' }, { status: 400 });
        }

        // Check for duplicate
        const existing = await db.level.findFirst({
            where: {
                year: year.trim(),
                                                  specialty: specialty.trim(),
            },
        });

        if (existing) {
            return NextResponse.json({ error: 'This level already exists' }, { status: 409 });
        }

        const level = await db.level.create({
            data: {
                year: year.trim(),
                                            specialty: specialty.trim(),
            },
        });

        return NextResponse.json({
            id: level.id,
            year: level.year,
            specialty: level.specialty,
            label: `${level.year} - ${level.specialty}`,
        });
    } catch (error) {
        console.error('POST /api/levels error:', error);
        return NextResponse.json({ error: 'Failed to create level' }, { status: 500 });
    }
}
