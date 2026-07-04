'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';
import { 
  ArrowLeft, Download, RefreshCw, Trash2, CheckCircle2, 
  Loader2, AlertCircle, FileCode, Play, Calendar, User, 
  Server, Shield, Cpu, ChevronRight, Terminal
} from 'lucide-react';

const TIMELINE_STEPS = [
  { key: 0, title: 'Pending', desc: 'Migration request queued in pipeline' },
  { key: 1, title: 'Scanning Codebase', desc: 'Running static analysis tools on uploaded zip' },
  { key: 2, title: 'Analyzing Dependencies', desc: 'Checking compatibility profiles of third-party vendors' },
  { key: 3, title: 'Checking Compatibility', desc: 'Scanning for deprecations and breaking changes' },
  { key: 4, title: 'Generating Migration Strategy', desc: 'Structuring code modification upgrade plans' },
  { key: 5, title: 'Completed', desc: 'Migration report ready' }
];

export default function ProjectDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  // Route protection
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // States
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const logTerminalRef = useRef(null);

  // Fetch project status details
  const fetchProjectDetails = async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    try {
      const response = await axios.get(`/api/project/${id}`);
      setProject(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Migration record not found or server error.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && id) {
      fetchProjectDetails(true);

      // Poll for status updates
      const interval = setInterval(() => {
        fetchProjectDetails(false);
      }, 2500);

      return () => clearInterval(interval);
    }
  }, [status, id]);

  // Scroll logs to bottom when updated
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [project?.logs]);

  // Reset scan handler
  const handleReRunScan = async () => {
    if (!id) return;
    setIsResetting(true);
    try {
      const response = await axios.put(`/api/project/${id}`);
      setProject(response.data);
    } catch (err) {
      console.error('Error restarting scan:', err);
      alert('Failed to restart scanning process.');
    } finally {
      setIsResetting(false);
    }
  };

  // Delete project handler
  const handleDelete = async () => {
    if (!id || !project) return;
    if (!confirm(`Are you sure you want to delete "${project.project_name}"?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await axios.delete(`/api/project/${id}`);
      router.push('/projects');
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project.');
      setIsDeleting(false);
    }
  };

  // Download report helper
  const handleDownloadReport = () => {
    if (!project) return;
    const reportText = `==================================================
STACK SHIFT - MIGRATION ANALYSIS REPORT
==================================================
Generated on: ${new Date().toLocaleString()}
Project Name: ${project.project_name}
Target System Stack: ${project.technology}
Source Version: ${project.current_version}
Target Version: ${project.target_version}
Migration Status: ${project.status}
Created By: ${project.user_name}
--------------------------------------------------
COMPATIBILITY METRICS:
Compatibility Score: ${project.score}%
Migration Complexity: ${project.complexity}
Estimated Upgrade Risk: ${project.risk}
Detected Potential Breaking Changes: ${project.breaking_changes}
--------------------------------------------------
MIGRATION LOGS & WALKTHROUGH PATH:
${project.logs ? project.logs.map((log, index) => `${index + 1}. [OK] ${log}`).join('\n') : 'No logs recorded.'}
--------------------------------------------------
RECOMMENDED UPGRADE PATHWAY:
1. Configure dependencies explicitly for ${project.target_version}.
2. Run standard syntax lint rules matching deprecated guidelines.
3. Validate runtime environments against generated compatibility profiles.
==================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stack-shift-${project.id}-report.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadgeStyle = (statusName) => {
    const norm = statusName?.toLowerCase();
    if (norm === 'completed') {
      return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30';
    }
    if (norm === 'failed') {
      return 'bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30';
    }
    if (norm === 'pending') {
      return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30';
    }
    // Scanning / Analyzing
    return 'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-400 border-purple-200/50 dark:border-purple-900/30 animate-pulse';
  };

  const getTechColorClass = (tech) => {
    if (tech === 'PHP') return 'bg-tech-php-bg text-tech-php-text';
    if (tech === 'Node.js') return 'bg-tech-js-bg text-tech-js-text';
    if (tech === 'Angular') return 'bg-tech-ng-bg text-tech-ng-text';
    if (tech === '.NET') return 'bg-tech-net-bg text-tech-net-text';
    return 'bg-surface-muted text-muted-text';
  };

  if (status === 'loading' || (loading && !project)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-purple border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-text">Retrieving live tracking pipeline...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle className="h-14 w-14 text-rose-500 mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Migration Record Not Found</h2>
            <p className="text-sm text-muted-text">{error || 'This project migration execution record does not exist or has been deleted.'}</p>
            <button
              onClick={() => router.push('/projects')}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-primary-purple hover:bg-hover-purple text-white text-sm font-bold rounded-xl transition-all duration-150 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Projects</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  const activeStep = project.activeStep ?? 0;
  const isFinished = project.status === 'Completed' || project.status === 'Failed';
  const isFailed = project.status === 'Failed';

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-grow mx-auto max-w-7xl w-full px-6 py-12 md:py-16 space-y-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border-muted pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={() => router.push('/projects')}
              className="p-2.5 border border-border-muted bg-card-bg hover:bg-bg-hover text-foreground rounded-xl transition-all duration-150 shadow-xs mr-1 cursor-pointer"
              title="Back to History"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{project.project_name}</h1>
                <span className={`px-3 py-1 text-xs font-bold rounded-md ${getTechColorClass(project.technology)}`}>
                  {project.technology}
                </span>
                <span className={`px-3.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeStyle(project.status)}`}>
                  {project.status === 'Scanning' ? 'Scanning...' : project.status}
                </span>
              </div>
              <p className="text-xs text-muted-text font-semibold flex items-center space-x-1.5">
                <span>Created at: {new Date(project.created_at).toLocaleString()}</span>
              </p>
            </div>
          </div>

          {/* Download Report (Top Right - only when finished) */}
          {isFinished && (
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 border border-primary-purple hover:bg-primary-purple/5 text-primary-purple font-bold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer"
            >
              <Download className="h-4.5 w-4.5" />
              <span>Download Report</span>
            </button>
          )}
        </div>

        {/* 2-COLUMN DETAILS LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SIDE: Project Summary & Timeline */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* Project Summary Card */}
            <div className="enterprise-card p-6 shadow-xs">
              <h3 className="text-lg font-bold text-foreground mb-4">Project Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Technology Stack</span>
                  <span className="font-semibold text-foreground">{project.technology}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Archive Package</span>
                  <span className="font-semibold text-foreground truncate block" title={project.zip_url}>{project.zip_url}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Current Version</span>
                  <span className="font-semibold text-foreground">{project.current_version}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Target Version</span>
                  <span className="font-semibold text-foreground">{project.target_version}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Started By</span>
                  <span className="font-semibold text-foreground flex items-center space-x-1.5">
                    <User className="h-3.5 w-3.5 text-primary-purple" />
                    <span>{project.user_name}</span>
                  </span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Pipeline ID</span>
                  <span className="font-mono text-xs text-foreground truncate block">{project.id}</span>
                </div>
              </div>
            </div>

            {/* Visual Live Migration Timeline */}
            <div className="enterprise-card p-6 shadow-xs">
              <h3 className="text-lg font-bold text-foreground mb-5">Migration Progress</h3>
              
              <div className="relative pl-8 space-y-6">
                
                {/* Visual vertical track line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border-muted dark:bg-white/5"></div>

                {TIMELINE_STEPS.map((step) => {
                  const stepIndex = step.key;
                  const isLastStep = stepIndex === TIMELINE_STEPS.length - 1;
                  
                  let isDone = stepIndex < activeStep;
                  let isActive = stepIndex === activeStep;
                  let isFuture = stepIndex > activeStep;
                  
                  let icon = null;
                  let iconColorClass = '';
                  
                  if (isDone) {
                    icon = <CheckCircle2 className="h-5 w-5" />;
                    iconColorClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                  } else if (isActive) {
                    if (isFailed && isLastStep) {
                      icon = <AlertCircle className="h-5 w-5" />;
                      iconColorClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
                    } else if (isFinished && !isFailed) {
                      // Final step complete
                      icon = <CheckCircle2 className="h-5 w-5" />;
                      iconColorClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
                    } else {
                      icon = <Loader2 className="h-5 w-5 animate-spin" />;
                      iconColorClass = 'bg-primary-purple/10 text-primary-purple';
                    }
                  } else {
                    icon = <div className="h-2 w-2 rounded-full bg-muted-text/60" />;
                    iconColorClass = 'bg-light-gray dark:bg-dark-bg/60 text-muted-text/40';
                  }

                  // Handle name changes for failed runs on the last step
                  let stepTitle = step.title;
                  let stepDesc = step.desc;
                  if (isLastStep && isFailed) {
                    stepTitle = 'Failed';
                    stepDesc = 'Migration analysis terminated with issues.';
                  }

                  return (
                    <div key={stepIndex} className="relative flex items-start space-x-4">
                      
                      {/* Circle/Icon */}
                      <div className={`absolute -left-[27px] flex h-[20px] w-[20px] items-center justify-center rounded-full z-10 ${
                        isActive ? 'scale-110 shadow-xs' : ''
                      } transition-all duration-300`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center border border-border-muted shrink-0 ${iconColorClass}`}>
                          {icon}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-0.5 pl-3">
                        <h4 className={`text-sm font-bold transition-colors duration-200 ${
                          isActive 
                            ? (isFailed && isLastStep ? 'text-rose-600 dark:text-rose-400' : 'text-primary-purple') 
                            : isDone ? 'text-foreground/80' : 'text-muted-text'
                        }`}>
                          {stepTitle}
                        </h4>
                        <p className={`text-xs transition-colors duration-200 ${
                          isActive ? 'text-foreground' : 'text-muted-text/80'
                        }`}>
                          {stepDesc}
                        </p>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

          </div>

          {/* RIGHT SIDE: Compatibility Report & Logs & Actions */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* Compatibility Report Card */}
            <div className="enterprise-card p-6 shadow-xs">
              <h3 className="text-lg font-bold text-foreground mb-4">Compatibility Profile</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                
                {/* Compatibility Score Circular Display */}
                <div className="flex flex-col items-center justify-center p-4 border border-border-muted bg-light-gray/20 dark:bg-dark-bg/20 rounded-2xl">
                  <div className="relative flex items-center justify-center">
                    {/* Circle SVG */}
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className="text-border-muted"
                        strokeWidth="8"
                        stroke="currentColor"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        className={isFailed ? "text-rose-500" : "text-primary-purple"}
                        strokeWidth="8"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * project.score) / 100}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-xl font-extrabold text-foreground">
                      {project.score}%
                    </span>
                  </div>
                  <span className="text-xs font-bold text-muted-text mt-3 uppercase tracking-wider">
                    Compatibility Score
                  </span>
                </div>

                 {/* Other Metrics */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border-muted text-sm">
                    <span className="text-muted-text font-medium">Complexity</span>
                    <span className={`font-bold ${
                      project.complexity === 'High' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                    }`}>
                      {project.complexity}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-muted text-sm">
                    <span className="text-muted-text font-medium">Upgrade Risk</span>
                    <span className={`font-bold ${
                      project.risk === 'High' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {project.risk}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-muted text-sm">
                    <span className="text-muted-text font-medium">Breaking Changes</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {project.breaking_changes}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* AI Analysis Logs Terminal */}
            <div className="enterprise-card p-6 shadow-xs flex flex-col h-[280px]">
              <div className="flex items-center justify-between mb-3.5 border-b border-border-muted pb-3">
                <div className="flex items-center space-x-2 text-sm font-bold text-foreground">
                  <Terminal className="h-4.5 w-4.5 text-primary-purple" />
                  <span>Analysis Terminal</span>
                </div>
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40"></div>
                </div>
              </div>
              
              <div 
                ref={logTerminalRef}
                className="flex-1 overflow-y-auto bg-neutral-950 text-neutral-100 p-4 rounded-xl font-mono text-xs space-y-2 select-text"
              >
                {project.logs && project.logs.map((log, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <span className="text-emerald-500 shrink-0 select-none">&gt;</span>
                    <span className={log.includes('Error') ? 'text-rose-400' : 'text-neutral-200'}>
                      {log}
                    </span>
                  </div>
                ))}
                {!isFinished && (
                  <div className="flex items-center space-x-2 text-muted-text animate-pulse">
                    <span className="text-emerald-500 shrink-0 select-none">&gt;</span>
                    <span>Waiting for diagnostic scanner processes...</span>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS PANEL */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleReRunScan}
                disabled={isResetting || !isFinished}
                className="flex-1 min-w-[140px] inline-flex items-center justify-center space-x-2 px-4 py-3 bg-primary-purple hover:bg-hover-purple disabled:bg-primary-purple/40 text-white font-bold text-sm rounded-xl shadow-xs transition-all duration-150 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                <span>Re-run Scan</span>
              </button>

              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center space-x-2 px-4 py-3 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-sm rounded-xl border border-rose-200/20 transition-all duration-150 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Project</span>
              </button>

              <button
                onClick={() => router.push('/projects')}
                className="inline-flex items-center justify-center space-x-2 px-4 py-3 bg-light-gray dark:bg-dark-bg hover:bg-bg-hover text-foreground font-bold text-sm rounded-xl border border-border-muted transition-all duration-150 cursor-pointer"
              >
                <span>Back to History</span>
              </button>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
