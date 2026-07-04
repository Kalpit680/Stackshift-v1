import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'projects.json');
const USERS_PATH = path.join(process.cwd(), 'users.json');

// Memory cache to track project start times for progress simulation without cluttering JSON
const creationTimes = new Map();

function getCreationTime(projectName) {
  if (!creationTimes.has(projectName)) {
    const seeds = ['CRM Upgrade', 'Billing System', 'Legacy Portal'];
    if (seeds.includes(projectName)) {
      // Seed migrations are pre-completed (created 24h ago)
      creationTimes.set(projectName, Date.now() - 3600000 * 24);
    } else {
      creationTimes.set(projectName, Date.now());
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
      // Seed with initial migrations conforming strictly to the 3-field requirement with HTTP URL paths
      const initialData = [
        {
          project_name: 'CRM Upgrade',
          user_name: 'Demo Admin',
          zip_url: 'http://localhost:3000/uploads/crm-v5.zip'
        },
        {
          project_name: 'Billing System',
          user_name: 'Demo Admin',
          zip_url: 'http://localhost:3000/uploads/billing-node.zip'
        },
        {
          project_name: 'Legacy Portal',
          user_name: 'Demo Admin',
          zip_url: 'http://localhost:3000/uploads/legacy-portal.zip'
        }
      ];
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
    
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const rawProjects = JSON.parse(data);

    // Dynamically augment projects with tech stacks and simulation data for the UI
    return rawProjects.map((p) => {
      const stackInfo = detectStack(p.project_name, p.zip_url);
      const id = p.project_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      return {
        id,
        project_name: p.project_name,
        user_name: p.user_name,
        zip_url: p.zip_url,
        technology: stackInfo.technology,
        current_version: stackInfo.current_version,
        target_version: stackInfo.target_version,
        created_at: getCreationTime(p.project_name)
      };
    });
  } catch (error) {
    console.error('Error reading DB:', error);
    return [];
  }
}

// Helper to write database (stores only name, user and zip_url)
export function writeDB(data) {
  try {
    // Filter out UI keys, write ONLY: project_name, user_name, zip_url
    const cleanData = data.map((p) => ({
      project_name: p.project_name,
      user_name: p.user_name,
      zip_url: p.zip_url
    }));
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

// Function to auto-detect technology stack from project metadata
export function detectStack(projectName, zipUrl) {
  const name = (projectName + ' ' + (zipUrl || '')).toLowerCase();
  
  if (name.includes('php') || name.includes('laravel') || name.includes('symfony') || name.includes('composer')) {
    return {
      technology: 'PHP',
      current_version: 'PHP 5.4',
      target_version: 'PHP 8.3'
    };
  }
  if (name.includes('node') || name.includes('npm') || name.includes('express') || name.includes('javascript') || name.includes('js')) {
    return {
      technology: 'Node.js',
      current_version: 'Node 12',
      target_version: 'Node 20'
    };
  }
  if (name.includes('angular') || name.includes('ng') || name.includes('ts') || name.includes('typescript')) {
    return {
      technology: 'Angular',
      current_version: 'Angular 8',
      target_version: 'Angular 18'
    };
  }
  if (name.includes('net') || name.includes('c#') || name.includes('asp') || name.includes('dotnet')) {
    return {
      technology: '.NET',
      current_version: '.NET Framework 4.5',
      target_version: '.NET 8'
    };
  }

  // Default fallback (deterministically cycles based on project name length)
  const choices = [
    { technology: 'PHP', current_version: 'PHP 5.6', target_version: 'PHP 8.3' },
    { technology: 'Node.js', current_version: 'Node 14', target_version: 'Node 20' },
    { technology: 'Angular', current_version: 'Angular 12', target_version: 'Angular 18' },
    { technology: '.NET', current_version: '.NET Framework 4.8', target_version: '.NET 8' }
  ];
  return choices[name.length % choices.length];
}

// Get project with calculated live status
export function getProjectStatus(project) {
  const elapsed = Date.now() - project.created_at;
  const isFailed = project.project_name.toLowerCase().includes('fail') || project.project_name.toLowerCase().includes('error');

  // Stages configuration
  let status = 'Pending';
  let activeStep = 0;
  
  if (elapsed < 5000) {
    status = 'Pending';
    activeStep = 0;
  } else if (elapsed < 15000) {
    status = 'Scanning';
    activeStep = 1;
  } else if (elapsed < 28000) {
    status = 'Analyzing';
    activeStep = 2;
  } else if (elapsed < 42000) {
    status = 'Analyzing';
    activeStep = 3;
  } else if (elapsed < 55000) {
    status = 'Analyzing';
    activeStep = 4;
  } else {
    status = isFailed ? 'Failed' : 'Completed';
    activeStep = 5;
  }

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
    score: project.score || (isFailed ? 34 : 88),
    complexity: project.complexity || (isFailed ? 'High' : 'Medium'),
    risk: project.risk || (isFailed ? 'High' : 'Low'),
    breaking_changes: project.breaking_changes || (isFailed ? 12 : 3)
  };
}
