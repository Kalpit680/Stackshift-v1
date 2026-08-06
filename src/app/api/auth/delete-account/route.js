import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { readUsersDB, writeUsersDB, readDB, writeDB } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const name = session.user.name;

    // 1. Delete user from users.json
    const users = readUsersDB();
    const updatedUsers = users.filter((u) => u.email?.toLowerCase() !== email);
    writeUsersDB(updatedUsers);

    // 2. Find and delete all user projects and files
    // Note: readDB returns dynamic augmented projects, but writeDB saves only raw projects {project_name, user_name, zip_url}
    const projects = readDB();
    const userProjects = projects.filter(
      (p) =>
        p.user_name?.toLowerCase() === email ||
        p.user_name?.toLowerCase() === name?.toLowerCase() ||
        p.user_name === 'Anonymous User' // clean fallback just in case
    );

    // Delete project zip files from uploads directory
    for (const project of userProjects) {
      if (project.zip_url) {
        try {
          const parsedUrl = new URL(project.zip_url);
          const filename = path.basename(parsedUrl.pathname);
          const zipPath = path.join(process.cwd(), 'public', 'uploads', filename);
          if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
          }
        } catch (e) {
          console.error(`Failed to delete zip file for project ${project.project_name}:`, e.message);
        }
      }
    }

    // Filter out user's projects from DB
    const remainingProjects = projects.filter(
      (p) =>
        p.user_name?.toLowerCase() !== email &&
        p.user_name?.toLowerCase() !== name?.toLowerCase()
    );
    writeDB(remainingProjects);

    return NextResponse.json({ success: true, message: 'Account permanently deleted.' });
  } catch (error) {
    console.error('Error during account deletion API execution:', error);
    return NextResponse.json({ error: 'Failed to delete user account.' }, { status: 500 });
  }
}
