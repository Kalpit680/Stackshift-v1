import { NextResponse } from 'next/server';
import { readDB, writeDB, registerCreationTime, detectStack } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const user_name = session.user.name;
    const project_name = formData.get('project_name');
    const technology = formData.get('technology') || 'PHP';
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

    // Determine target name with technology suffix for bulletproof DB scanning
    const ext = path.extname(file.name);
    const base = path.basename(file.name, ext);
    const techSuffix = technology.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const finalFileName = `${base}-${techSuffix}${ext}`;

    // Save the file binary onto disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, finalFileName);
    await writeFile(filePath, buffer);

    // Register creation time in-memory for live progress simulation
    registerCreationTime(project_name, Date.now());

    // Resolve current protocol and host dynamically
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const cleanZipUrl = `${protocol}://${host}/uploads/${finalFileName}`;

    let analysis = null;

    try {
      const scriptPath = path.join(process.cwd(), 'backend', 'analyze_zip.py');
      const { stdout } = await execFilePromise('python', [scriptPath, filePath]);
      analysis = JSON.parse(stdout.toString());
    } catch (error) {
      console.warn('Fallback analysis used:', error.message);
      analysis = detectStack(project_name, null); // Call without zipUrl to avoid sync python execution
    }

    const newProject = {
      project_name,
      user_name: user_name || 'Anonymous User',
      zip_url: cleanZipUrl
    };

    // Prepend new project and write database
    projects.unshift(newProject);
    writeDB(projects);

    // OPTIONAL: Forward project metadata to external Laravel backend API in real time if configured
    const laravelApiUrl = process.env.LARAVEL_API_URL || null;
    if (laravelApiUrl) {
      try {
        await fetch(laravelApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            project_name,
            user_name: user_name || 'Anonymous User',
            zip_url: cleanZipUrl
          })
        });
      } catch (err) {
        console.error('Failed to forward project metadata to Laravel API:', err.message);
      }
    }

    const cleanId = project_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return NextResponse.json({
      id: cleanId,
      ...newProject,
      message: 'ZIP successfully uploaded and analyzed.',
      analysis: {
        ...analysis,
        fileName: file.name,
        zipPath: cleanZipUrl
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving uploaded file locally:', error);
    return NextResponse.json({ error: 'Failed to upload and save project locally.' }, { status: 500 });
  }
}
