import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DB_PATH = path.join(process.cwd(), 'projects.json');
const USERS_PATH = path.join(process.cwd(), 'users.json');

// Memory cache to track project start times for progress simulation without cluttering JSON
const creationTimes = new Map();

function getCreationTime(projectName, savedTimestamp) {
  if (!creationTimes.has(projectName)) {
    if (savedTimestamp) {
      creationTimes.set(projectName, savedTimestamp);
    } else {
      const seeds = ['CRM Upgrade', 'Billing System', 'Legacy Portal'];
      if (seeds.includes(projectName)) {
        // Seed migrations are pre-completed (created 24h ago)
        creationTimes.set(projectName, Date.now() - 3600000 * 24);
      } else {
        creationTimes.set(projectName, Date.now());
      }
    }
  }
  return creationTimes.get(projectName);
}

export function registerCreationTime(projectName, timestamp) {
  creationTimes.set(projectName, timestamp || Date.now());
}

// Helper to read database
export function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Seed with initial migrations conforming strictly to the requirement with HTTP URL paths
      const initialData = [
        {
          project_name: 'CRM Upgrade',
          user_name: 'Demo Admin',
          zip_url: 'http://localhost:3000/uploads/crm-v5.zip',
          created_at: Date.now() - 3600000 * 24
        },
        {
          project_name: 'Billing System',
          user_name: 'Demo Admin',
          zip_url: 'http://localhost:3000/uploads/billing-node.zip',
          created_at: Date.now() - 3600000 * 24
        },
        {
          project_name: 'Legacy Portal',
          user_name: 'Demo Admin',
          zip_url: 'http://localhost:3000/uploads/legacy-portal.zip',
          created_at: Date.now() - 3600000 * 24
        }
      ];
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
    
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const rawProjects = JSON.parse(data);

    // Dynamically augment projects with tech stacks and simulation data for the UI
    return rawProjects.map((p) => {
      // Use stored analysis if available, otherwise fallback to detectStack
      const stackInfo = p.technology ? p : detectStack(p.project_name, p.zip_url);
      const id = p.project_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Check for upgrade sidecar file
      let upgraded = false;
      let upgraded_zip_url = null;
      let migration_diffs = [];
      let tech_upgrades = {};
      let upgraded_files_count = 0;
      let completed_with_warnings = false;
      let remaining_apis = {};
      let remaining_apis_details = [];
      let rule_diagnostics = {};

      const sidecarPath = path.join(process.cwd(), 'public', 'uploads', `upgraded-report-${id}.json`);
      if (fs.existsSync(sidecarPath)) {
        try {
          const report = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
          upgraded = true;
          upgraded_zip_url = report.upgraded_zip_url;
          migration_diffs = report.diffs || [];
          tech_upgrades = report.tech_upgrades || {};
          upgraded_files_count = report.upgraded_files_count || 0;
          completed_with_warnings = report.completed_with_warnings || false;
          remaining_apis = report.remaining_apis || {};
          remaining_apis_details = report.remaining_apis_details || [];
          rule_diagnostics = report.rule_diagnostics || {};
        } catch (e) {
          console.error(`Failed to load sidecar report for ${id}:`, e.message);
        }
      }

      const created_at = p.created_at || getCreationTime(p.project_name, Date.now() - 3600000 * 24);
      registerCreationTime(p.project_name, created_at);

      return {
        id,
        project_name: p.project_name,
        user_name: p.user_name,
        zip_url: p.zip_url,
        technology: stackInfo.technology,
        current_version: stackInfo.current_version,
        target_version: stackInfo.target_version,
        score: stackInfo.score !== undefined ? stackInfo.score : p.score,
        complexity: stackInfo.complexity || p.complexity,
        risk: stackInfo.risk || p.risk,
        breaking_changes: stackInfo.breaking_changes !== undefined ? stackInfo.breaking_changes : p.breaking_changes,
        total_files: stackInfo.total_files !== undefined ? stackInfo.total_files : p.total_files,
        languages: stackInfo.languages || p.languages || {},
        migration_candidates: stackInfo.migration_candidates || p.migration_candidates || [],
        upgraded,
        upgraded_zip_url,
        migration_diffs,
        tech_upgrades,
        upgraded_files_count,
        completed_with_warnings,
        remaining_apis,
        remaining_apis_details,
        rule_diagnostics,
        created_at
      };
    });
  } catch (error) {
    console.error('Error reading DB:', error);
    return [];
  }
}

// Helper to write database (stores name, user, zip_url, created_at, and analysis data)
export function writeDB(data) {
  try {
    const cleanData = data.map((p) => {
      const pData = {
        project_name: p.project_name,
        user_name: p.user_name,
        zip_url: p.zip_url,
        created_at: p.created_at || getCreationTime(p.project_name)
      };
      
      // Preserve analysis data to prevent slow recalculations via Python scripts
      if (p.technology) pData.technology = p.technology;
      if (p.current_version) pData.current_version = p.current_version;
      if (p.target_version) pData.target_version = p.target_version;
      if (p.score !== undefined) pData.score = p.score;
      if (p.complexity) pData.complexity = p.complexity;
      if (p.risk) pData.risk = p.risk;
      if (p.breaking_changes !== undefined) pData.breaking_changes = p.breaking_changes;
      if (p.total_files !== undefined) pData.total_files = p.total_files;
      if (p.languages) pData.languages = p.languages;
      if (p.migration_candidates) pData.migration_candidates = p.migration_candidates;
      
      return pData;
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(cleanData, null, 2));
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

// Helper to read users database
export function readUsersDB() {
  try {
    if (!fs.existsSync(USERS_PATH)) {
      const initialUsers = [
        {
          name: 'Demo Admin',
          email: 'admin@stackshift.com',
          password: 'password123'
        }
      ];
      fs.writeFileSync(USERS_PATH, JSON.stringify(initialUsers, null, 2));
      return initialUsers;
    }
    const data = fs.readFileSync(USERS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users DB:', error);
    return [];
  }
}

// Helper to write users database
export function writeUsersDB(data) {
  try {
    fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing users DB:', error);
  }
}

// Memory cache to avoid running python subprocesses on every 3-second API poll
const stackCache = new Map();

// Function to auto-detect technology stack from project metadata
export function detectStack(projectName, zipUrl) {
  const cacheKey = `${projectName}:${zipUrl || ''}`;
  if (stackCache.has(cacheKey)) {
    return stackCache.get(cacheKey);
  }

  if (zipUrl) {
    try {
      // Extract filename from URL (e.g. http://localhost:3000/uploads/my-project.zip -> my-project.zip)
      const parsedUrl = new URL(zipUrl);
      const filename = path.basename(parsedUrl.pathname);
      const zipPath = path.join(process.cwd(), 'public', 'uploads', filename);

      if (fs.existsSync(zipPath)) {
        const scriptPath = path.join(process.cwd(), 'backend', 'analyze_zip.py');
        const cmd = `python "${scriptPath}" "${zipPath}"`;
        const output = execSync(cmd).toString();
        const detected = JSON.parse(output);
        if (detected && detected.technology) {
          stackCache.set(cacheKey, detected);
          return detected;
        }
      }
    } catch (e) {
      console.error('Failed to auto-detect stack from ZIP contents:', e);
    }
  }

  const name = (projectName + ' ' + (zipUrl || '')).toLowerCase();
  
  if (name.includes('-php')) {
    return {
      technology: 'PHP',
      current_version: 'PHP 5.4',
      target_version: 'PHP 8.3 (Recommended)'
    };
  }
  if (name.includes('-nodejs')) {
    return {
      technology: 'Node.js',
      current_version: 'Node 12',
      target_version: 'Node 20 (Recommended)'
    };
  }
  if (name.includes('-angular')) {
    return {
      technology: 'Angular',
      current_version: 'Angular 8',
      target_version: 'Angular 18 (Recommended)'
    };
  }
  if (name.includes('-dotnet')) {
    return {
      technology: '.NET',
      current_version: '.NET Framework 4.5',
      target_version: '.NET 8 (Recommended)'
    };
  }
  if (name.includes('-vbnet')) {
    return {
      technology: 'VB.NET',
      current_version: 'VB.NET 2010',
      target_version: '.NET 8 (VB) (Recommended)'
    };
  }

  if (name.includes('php') || name.includes('laravel') || name.includes('symfony') || name.includes('composer')) {
    return {
      technology: 'PHP',
      current_version: 'PHP 5.4',
      target_version: 'PHP 8.3 (Recommended)'
    };
  }
  if (name.includes('node') || name.includes('npm') || name.includes('express') || name.includes('javascript') || name.includes('js')) {
    return {
      technology: 'Node.js',
      current_version: 'Node 12',
      target_version: 'Node 20 (Recommended)'
    };
  }
  if (name.includes('angular') || name.includes('ng') || name.includes('ts') || name.includes('typescript')) {
    return {
      technology: 'Angular',
      current_version: 'Angular 8',
      target_version: 'Angular 18 (Recommended)'
    };
  }
  if (name.includes('net') || name.includes('c#') || name.includes('dotnet')) {
    return {
      technology: '.NET',
      current_version: '.NET Framework 4.5',
      target_version: '.NET 8 (Recommended)'
    };
  }
  if (name.includes('vb') || name.includes('visualbasic') || name.includes('basic')) {
    return {
      technology: 'VB.NET',
      current_version: 'VB.NET 2010',
      target_version: '.NET 8 (VB) (Recommended)'
    };
  }

  // Default fallback (deterministically cycles based on project name length)
  const choices = [
    { technology: 'PHP', current_version: 'PHP 5.6', target_version: 'PHP 7.4 (Recommended)' },
    { technology: 'Node.js', current_version: 'Node 14', target_version: 'Node 20 (Recommended)' },
    { technology: 'Angular', current_version: 'Angular 12', target_version: 'Angular 18 (Recommended)' },
    { technology: '.NET', current_version: '.NET Framework 4.8', target_version: '.NET 8 (Recommended)' },
    { technology: 'VB.NET', current_version: 'VB.NET 2012', target_version: '.NET 8 (VB) (Recommended)' }
  ];
  const res = choices[name.length % choices.length];
  stackCache.set(cacheKey, res);
  return res;
}

// Get project with calculated live status
export function getProjectStatus(project) {
  const elapsed = Date.now() - project.created_at;
  const isFailed = project.project_name.toLowerCase().includes('fail') || project.project_name.toLowerCase().includes('error');

  // Calculate estimated total scan/migration time in seconds dynamically matching frontend
  const candidateCount = project.migration_candidates?.length || project.breaking_changes || 1;
  const fileCount = project.total_files || 5;
  const totalEstimatedSec = Math.max(20, Math.min(120, candidateCount * 8 + Math.ceil(fileCount / 4) * 5));
  
  const elapsedSec = Math.floor(elapsed / 1000);

  // Stages configuration
  let status = 'Pending';
  let activeStep = 0;
  
  const stepDuration = totalEstimatedSec / 5; // Divide the time into 5 steps roughly
  
  if (project.upgraded) {
    status = 'Migrated';
    activeStep = 5;
  } else if (elapsedSec >= totalEstimatedSec) {
    status = isFailed ? 'Failed' : 'Completed';
    activeStep = 5;
  } else if (elapsedSec < stepDuration * 0.5) {
    status = 'Pending';
    activeStep = 0;
  } else if (elapsedSec < stepDuration * 1.5) {
    status = 'Scanning';
    activeStep = 1;
  } else if (elapsedSec < stepDuration * 2.5) {
    status = 'Analyzing';
    activeStep = 2;
  } else if (elapsedSec < stepDuration * 3.5) {
    status = 'Analyzing';
    activeStep = 3;
  } else {
    status = 'Analyzing';
    activeStep = 4;
  }

  const remainingSec = (status === 'Completed' || status === 'Failed' || status === 'Migrated') ? 0 : Math.max(0, totalEstimatedSec - elapsedSec);

  const formatSec = (secs) => {
    if (secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // Build standard logs based on the elapsed time
  const fullLogs = [
    'Detected project framework structure...',
    `Scanning codebase with stack config (${project.technology})...`,
    `Analyzing legacy dependencies from repository config...`,
    `Checking backwards compatibility against target version ${project.target_version}...`,
    'Generating optimal target migration path...',
    isFailed ? 'Error: Failed to migrate codebase. Deprecated modules conflict.' : 'Migration strategy generated. Walkthrough report available.'
  ];

  const currentLogs = [];
  for (let i = 0; i <= activeStep; i++) {
    if (fullLogs[i]) {
      currentLogs.push(fullLogs[i]);
    }
  }

  return {
    ...project,
    status,
    activeStep,
    logs: currentLogs,
    estimated_seconds: totalEstimatedSec,
    remaining_seconds: remainingSec,
    formatted_estimated_time: formatSec(totalEstimatedSec),
    formatted_remaining_time: formatSec(remainingSec),
    score: project.score !== undefined ? project.score : (isFailed ? 34 : 88),
    complexity: project.complexity || (isFailed ? 'High' : 'Medium'),
    risk: project.risk || (isFailed ? 'High' : 'Low'),
    breaking_changes: project.breaking_changes !== undefined ? project.breaking_changes : (isFailed ? 12 : 3)
  };
}
