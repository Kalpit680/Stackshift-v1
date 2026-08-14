import { NextResponse } from 'next/server';
import { readDB, getProjectStatus, writeDB } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req, { params }) {
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

    // Locate the source ZIP filename from zip_url
    const parsedUrl = new URL(project.zip_url);
    const filename = path.basename(parsedUrl.pathname);
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const zipPath = path.join(uploadsDir, filename);

    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Source project ZIP archive not found on disk.' }, { status: 404 });
    }

    let payload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const targetVersion = payload.targetVersion || project.target_version || null;
    const framework = payload.framework || null;

    if (payload.targetVersion || payload.framework) {
      project.target_version = targetVersion;
      if (framework) project.framework = framework;
      writeDB(projects);
    }

    const upgradedFilename = `upgraded-${filename}`;
    const upgradedZipPath = path.join(uploadsDir, upgradedFilename);

    const scriptPath = path.join(process.cwd(), 'backend', 'upgrade_code.py');
    const outputJsonPath = path.join(uploadsDir, `upgrade-output-${id}-${Date.now()}.json`);
    const sidecarPath = path.join(uploadsDir, `upgraded-report-${id}.json`);
    if (fs.existsSync(sidecarPath)) {
      fs.unlinkSync(sidecarPath);
    }
    const command = `python "${scriptPath}" "${zipPath}" "${upgradedZipPath}"${targetVersion ? ` --target-version "${targetVersion}"` : ''}${framework ? ` --framework "${framework}"` : ''} --output "${outputJsonPath}"`;

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';

    // Execute Python in background (fire-and-forget) to unblock the frontend timer
    exec(command, async (error, stdout, stderr) => {
      if (stderr && stderr.trim()) {
        console.warn('Python upgrade script warning/error output:', stderr);
      }

      try {
        if (!fs.existsSync(outputJsonPath)) {
          console.error('Upgrade script failed to produce an output file');
          return;
        }

        const resultFile = await fs.promises.readFile(outputJsonPath, 'utf8');
        const result = JSON.parse(resultFile);
        await fs.promises.unlink(outputJsonPath); // Clean up the temporary file

        if (result.status === 'error') {
          console.error('Upgrade failed:', result.message);
          return;
        }

        // Resolve URL for the upgraded ZIP file
        const upgradedZipUrl = `${protocol}://${host}/uploads/${upgradedFilename}`;

        // Store upgrade reports in a local sidecar JSON file
        const sidecarReport = {
          upgraded_zip_url: upgradedZipUrl,
          diffs: result.diffs,
          tech_upgrades: result.tech_upgrades,
          upgraded_files_count: result.upgraded_files_count,
          completed_with_warnings: result.completed_with_warnings || false,
          remaining_apis: result.remaining_apis || {},
          remaining_apis_details: result.remaining_apis_details || [],
          rule_diagnostics: result.rule_diagnostics || {},
          report_metrics: result.report_metrics || {}
        };

        // We already defined sidecarPath above
        
        // Truncate diffs for the UI response to prevent massive payloads crashing the browser when polled
        const uiReport = { ...sidecarReport };
        if (uiReport.diffs && uiReport.diffs.length > 50) {
          uiReport.diffs = uiReport.diffs.slice(0, 50);
          uiReport.diffs.push({ file: '...', diff: `... and ${sidecarReport.diffs.length - 50} more files modified.` });
        }

        fs.writeFileSync(sidecarPath, JSON.stringify(uiReport, null, 2));
      } catch (err) {
        console.error('Background upgrade processing error:', err);
      }
    });

    // Return the response immediately to unblock the UI and trigger the redirect
    return NextResponse.json({
      success: true,
      message: 'Codebase upgrade process started in the background.'
    });

  } catch (error) {
    console.error('Error upgrading codebase:', error);
    return NextResponse.json({ error: 'Failed to upgrade codebase' }, { status: 500 });
  }
}
