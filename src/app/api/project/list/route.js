import { NextResponse } from 'next/server';
import { readDB, getProjectStatus } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get('user');

    let projects = readDB();

    // Filter by user if specified
    if (user) {
      projects = projects.filter((p) => p.user_name?.toLowerCase() === user.toLowerCase());
    }

    // Process live status for each project
    const activeProjects = projects.map(getProjectStatus);

    return NextResponse.json(activeProjects);
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
  }
}
