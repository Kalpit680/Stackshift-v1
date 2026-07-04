import { NextResponse } from 'next/server';
import { readDB, writeDB, registerCreationTime } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const user_name = formData.get('user_name');
    const project_name = formData.get('project_name');
    const file = formData.get('file'); // File binary object

    if (!project_name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File upload is required' }, { status: 400 });
    }

    const projects = readDB();

    // Check if project name is unique per user (case insensitive)
    const isDuplicate = projects.some(
      (p) =>
        p.user_name?.toLowerCase() === user_name?.toLowerCase() &&
        p.project_name?.toLowerCase() === project_name?.toLowerCase()
    );

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'A project with this name already exists for your account. Please use a unique name.' },
        { status: 400 }
      );
    }

    // Ensure the public/uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Save the file binary onto disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, file.name);
    await writeFile(filePath, buffer);

    // Register creation time in-memory for live progress simulation
    registerCreationTime(project_name, Date.now());

    // Resolve current protocol and host dynamically
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const cleanZipUrl = `${protocol}://${host}/uploads/${file.name}`;

    // Prepare clean project payload conforming to the 3-field requirement
    const newProject = {
      project_name,
      user_name: user_name || 'Anonymous User',
      zip_url: cleanZipUrl
    };

    // Prepend new project and write database
    projects.unshift(newProject);
    writeDB(projects);

    const cleanId = project_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return NextResponse.json({
      id: cleanId,
      ...newProject
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving uploaded file locally:', error);
    return NextResponse.json({ error: 'Failed to upload and save project locally.' }, { status: 500 });
  }
}
