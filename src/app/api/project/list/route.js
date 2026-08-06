import { NextResponse } from 'next/server';
import { readDB, getProjectStatus } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userName = session.user.name;
    let projects = readDB();

    // Filter by the logged-in user's name (case-insensitively)
    projects = projects.filter((p) => p.user_name?.toLowerCase() === userName.toLowerCase());

    // Process live status for each project
    const activeProjects = projects.map(getProjectStatus);

    return NextResponse.json(activeProjects);
  } catch (error) {
    console.error('Error listing projects:', error);
    return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
  }
}
