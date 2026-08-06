import { NextResponse } from 'next/server';
import { readDB, writeDB, getProjectStatus, registerCreationTime } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userName = session.user.name;
    const { id } = await params;
    const projects = readDB(); // Gets augmented projects
    const project = projects.find((p) => p.id === id);

    if (!project || project.user_name?.toLowerCase() !== userName.toLowerCase()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updatedProject = getProjectStatus(project);
    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userName = session.user.name;
    const { id } = await params;
    const projects = readDB();

    const project = projects.find((p) => p.id === id);
    if (!project || project.user_name?.toLowerCase() !== userName.toLowerCase()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const filtered = projects.filter((p) => p.id !== id);

    // writeDB will automatically filter and write only project_name, user_name, zip_url
    writeDB(filtered);
    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userName = session.user.name;
    const { id } = await params;
    const projects = readDB();
    const project = projects.find((p) => p.id === id);

    if (!project || project.user_name?.toLowerCase() !== userName.toLowerCase()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Reset created_at in-memory to restart the progress timeline simulation
    registerCreationTime(project.project_name, Date.now());

    const updatedProject = getProjectStatus({
      ...project,
      created_at: Date.now()
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Error resetting project scan:', error);
    return NextResponse.json({ error: 'Failed to reset project scan' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userName = session.user.name;
    const { id } = await params;
    const projects = readDB();
    const project = projects.find((p) => p.id === id);

    if (!project || project.user_name?.toLowerCase() !== userName.toLowerCase()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    if (body.current_version) {
      project.current_version = body.current_version;
      writeDB(projects);
    }

    return NextResponse.json({ success: true, project: getProjectStatus(project) });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
