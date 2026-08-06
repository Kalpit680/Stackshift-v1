'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';
import { 
  ArrowLeft, Download, RefreshCw, Trash2, CheckCircle2, 
  Loader2, AlertCircle, FileCode, Play, Calendar, User, 
  Server, Shield, Cpu, ChevronRight, Terminal, Sparkles, FileArchive, Code
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
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const [upgradeRemainingSec, setUpgradeRemainingSec] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [remainingTime, setRemainingTime] = useState('');
  
  const logTerminalRef = useRef(null);
  const upgradeTimerRef = useRef(null);

  // Live increasing percentage animation for compatibility score
  useEffect(() => {
    if (project && typeof project.score === 'number') {
      const end = project.score;
      if (end === 0) {
        setAnimatedScore(0);
        return;
      }
      
      const duration = 2000; // 2 seconds animation duration
      const startTime = performance.now();
      
      let animationFrameId;
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (easeOutQuad)
        const easeProgress = progress * (2 - progress);
        const currentScore = Math.round(easeProgress * end);
        setAnimatedScore(currentScore);
        
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        }
      };
      
      animationFrameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [project?.score]);

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

  // Safety fallback if session status or initial fetch takes too long
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading && !project && status !== 'unauthenticated') {
        setLoading(false);
        if (!error) {
          setError('Unable to load project data. Please try refreshing.');
        }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading, project, status, error]);

  // Scroll logs to bottom when updated
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [project?.logs]);

  useEffect(() => {
    if (!project) {
      setRemainingTime('');
      return;
    }

    const candidateCount = project.migration_candidates?.length || project.breaking_changes || 0;
    const minutes = Math.max(1, Math.min(8, Math.ceil(candidateCount / 3) + 1));
    setRemainingTime(`${minutes} min`);
  }, [project]);

  // Auto-download the ZIP file when the upgrade completes in the background
  useEffect(() => {
    if (isUpgrading && project?.upgraded) {
      if (upgradeTimerRef.current) clearInterval(upgradeTimerRef.current);
      setUpgradeProgress(100);
      setUpgradeRemainingSec(0);
      
      if (project.upgraded_zip_url) {
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = project.upgraded_zip_url;
          link.setAttribute('download', '');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setIsUpgrading(false);
        }, 1000); // 1s delay so user sees the 100% full progress bar
      } else {
        setIsUpgrading(false);
      }
    }
  }, [project?.upgraded, isUpgrading, project?.upgraded_zip_url]);

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

  const handleUpdateCurrentVersion = async (e) => {
    const newVersion = e.target.value;
    try {
      await axios.patch(`/api/project/${id}`, { current_version: newVersion });
      setProject({ ...project, current_version: newVersion });
    } catch (err) {
      console.error('Error updating current version:', err);
    }
  };

  const handleUpgradeCodebase = async () => {
    if (!id || !project) return;
    if (!confirm('Are you sure you want to upgrade the codebase version? This will perform dynamic refactoring, resolve legacy syntax, and output code diff reports.')) {
      return;
    }
    
    setIsUpgrading(true);
    setUpgradeProgress(0);
    const estimated = 30; // approx 30 seconds for background script
    setUpgradeRemainingSec(estimated);

    if (upgradeTimerRef.current) clearInterval(upgradeTimerRef.current);
    upgradeTimerRef.current = setInterval(() => {
      setUpgradeRemainingSec((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
      setUpgradeProgress((prev) => {
        if (prev >= 98) return 98; // hold at 98% until server says complete
        return prev + (100 / estimated);
      });
    }, 1000);

    try {
      const response = await axios.post(`/api/project/${id}/upgrade`);
      if (response.data.success) {
        fetchProjectDetails(false);
      }
    } catch (err) {
      console.error('Error upgrading codebase:', err);
      alert(err.response?.data?.error || 'Failed to complete codebase upgrade.');
      if (upgradeTimerRef.current) clearInterval(upgradeTimerRef.current);
      setIsUpgrading(false);
    }
  };

  const handleDownloadMigrationReport = () => {
    if (!project) return;
    
    const techUpgradesText = project.tech_upgrades && Object.keys(project.tech_upgrades).length > 0
      ? Object.entries(project.tech_upgrades).map(([tech, versions]) => `  - ${tech}: ${versions.before} ===> ${versions.after}`).join('\n')
      : '  - General: Legacy Stack ===> Modernized Target';

    const diffsText = project.migration_diffs && project.migration_diffs.length > 0
      ? project.migration_diffs.map((d) => `File: ${d.file}\n--------------------------------------------------\n${d.diff}\n--------------------------------------------------`).join('\n\n')
      : 'No lines required changes. The codebase is already compatible.';

    const reportText = `==================================================
STACK SHIFT - CODEBASE UPGRADE & MIGRATION REPORT
==================================================
Generated on: ${new Date().toLocaleString()}
Project Name: ${project.project_name}
Target System Stack: ${project.technology}
Total Files Scanned: ${project.total_files || 0}
Upgrade Status: COMPLETE

STACK/VERSION TRANSITION:
${techUpgradesText}

--------------------------------------------------
MIGRATION ANALYSIS AND CODE CHANGES (DIFFS):
--------------------------------------------------
Below are the exact unified diffs representing lines of code that were written previously (marked with -) and are now replaced or added after upgrading (marked with +):

${diffsText}

==================================================
Report generated automatically by Stack Shift.
==================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stack-shift-${project.id}-migration-report.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReport = () => {
    if (!project) return;
    const languagesText = project.languages && Object.keys(project.languages).length > 0 
      ? Object.entries(project.languages).map(([lang, count]) => `  - ${lang}: ${count} file(s)`).join('\n')
      : '  - None';

    const reportText = `==================================================
STACK SHIFT - MIGRATION ANALYSIS REPORT
==================================================
Generated on: ${new Date().toLocaleString()}
Project Name: ${project.project_name}
Target System Stack: ${project.technology}
Source Version: ${project.current_version}
Target Version: ${project.target_version}
Migration Status: ${project.status}
Total Codebase Files: ${project.total_files || 0}
Codebase Languages:
${languagesText}
Created By: ${project.user_name}
--------------------------------------------------
COMPATIBILITY METRICS:
Compatibility Score: ${project.score}%
Migration Complexity: ${project.complexity}
Estimated Upgrade Risk: ${project.risk}
Detected Potential Breaking Changes: ${project.breaking_changes}
--------------------------------------------------
ANALYSIS ESSENCE & COMPATIBILITY INSIGHTS:
- Technology Stack identified as ${project.technology}.
- Code health evaluation resolved to a compatibility index of ${project.score}%.
- Identified ${project.breaking_changes} potential breaking change(s) requiring remediation.
- Overall migration complexity classified as ${project.complexity} with a ${project.risk} risk profile.
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
    if (norm === 'completed' || norm === 'migrated') {
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
  const isFinished = project.status === 'Completed' || project.status === 'Failed' || project.status === 'Migrated';
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
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                {isFinished 
                  ? (project.completed_with_warnings 
                     ? `Review ready • Migration completed with warnings (Est: ${project.formatted_estimated_time || '55s'})`
                     : `Review ready • Migration complete (Est: ${project.formatted_estimated_time || '55s'})`)
                  : `Migration in progress • Remaining left: ${project.formatted_remaining_time || '0s'} (Estimated: ${project.formatted_estimated_time || '55s'})`
                }
              </p>
            </div>
          </div>

          {/* Action Buttons (Top Right - only when finished) */}
          {isFinished && !isFailed && (
            <div className="flex flex-wrap items-center gap-3">
              {!project.upgraded ? (
                <>
                  <button
                    onClick={handleDownloadReport}
                    className="inline-flex items-center justify-center space-x-2 px-5 py-3 border border-border-color bg-card-bg hover:bg-bg-hover text-foreground font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer"
                  >
                    <Download className="h-4.5 w-4.5 text-muted-text" />
                    <span>Download Scan Report</span>
                  </button>
                  {isUpgrading ? (
                    <div className="flex flex-col items-end min-w-[280px] space-y-2">
                      <div className="flex items-center justify-between w-full text-xs font-bold text-foreground">
                        <span className="flex items-center space-x-2 text-primary-purple">
                          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                          <span>Upgrading Codebase...</span>
                        </span>
                        <span className="px-2 py-0.5 bg-primary-purple text-white text-[10px] font-extrabold rounded-md font-mono">
                          {upgradeRemainingSec}s left
                        </span>
                      </div>
                      <div className="w-full bg-surface-muted h-2.5 rounded-full overflow-hidden border border-border-muted/50 shadow-inner">
                        <div 
                          className="bg-primary-purple h-full transition-all duration-1000 ease-linear rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                          style={{ width: `${Math.min(100, Math.round(upgradeProgress))}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleUpgradeCodebase}
                      className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-primary-purple to-purple-600 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-primary-purple/20 transition-all duration-200 cursor-pointer"
                    >
                      <Sparkles className="h-4.5 w-4.5" />
                      <span>Upgrade Codebase</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleDownloadMigrationReport}
                    className="inline-flex items-center justify-center space-x-2 px-5 py-3 border border-border-color bg-card-bg hover:bg-bg-hover text-foreground font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer"
                  >
                    <Download className="h-4.5 w-4.5 text-muted-text" />
                    <span>Download Migration Report</span>
                  </button>
                  <a
                    href={project.upgraded_zip_url}
                    download
                    className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-500/20 transition-all duration-200 cursor-pointer"
                  >
                    <FileArchive className="h-4.5 w-4.5" />
                    <span>Download Modernized Code (.zip)</span>
                  </a>
                </>
              )}
            </div>
          )}

          {isFinished && isFailed && (
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 border border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10 text-rose-700 dark:text-rose-400 font-semibold text-sm rounded-xl shadow-xs transition-all duration-200 cursor-pointer"
            >
              <Download className="h-4.5 w-4.5" />
              <span>Download Incident Report</span>
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
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Migration Review</span>
                  <span className="font-semibold text-foreground">{project.migration_candidates?.length ? `${project.migration_candidates.length} file(s) flagged` : 'No major blockers detected'}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Technology Stack</span>
                  <span className="font-semibold text-foreground">{project.technology}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Archive Package</span>
                  <span className="font-semibold text-foreground truncate block" title={project.zip_url}>{project.zip_url}</span>
                </div>
                <div className="space-y-1 bg-light-gray/40 dark:bg-dark-bg/40 p-3 rounded-xl border border-border-muted relative group">
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Current Version</span>
                  {!project.upgraded ? (
                    <select
                      className="w-full bg-transparent font-semibold text-foreground border-none outline-none focus:ring-0 p-0 appearance-none cursor-pointer"
                      value={project.current_version || ''}
                      onChange={handleUpdateCurrentVersion}
                    >
                      <option className="bg-card-bg" value="PHP 5.2">PHP 5.2</option>
                      <option className="bg-card-bg" value="PHP 5.4">PHP 5.4</option>
                      <option className="bg-card-bg" value="PHP 5.6">PHP 5.6</option>
                      <option className="bg-card-bg" value="PHP 7.0">PHP 7.0</option>
                      <option className="bg-card-bg" value="Node 10">Node 10</option>
                      <option className="bg-card-bg" value="Node 12">Node 12</option>
                      <option className="bg-card-bg" value="Node 14">Node 14</option>
                      {project.current_version && !['PHP 5.2', 'PHP 5.4', 'PHP 5.6', 'PHP 7.0', 'Node 10', 'Node 12', 'Node 14'].includes(project.current_version) && (
                        <option className="bg-card-bg" value={project.current_version}>{project.current_version}</option>
                      )}
                    </select>
                  ) : (
                    <span className="font-semibold text-foreground">{project.current_version}</span>
                  )}
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
                  <span className="text-xs font-bold text-muted-text block uppercase tracking-wider">Total ZIP Files</span>
                  <span className="font-semibold text-foreground">{project.total_files || 0}</span>
                </div>
              </div>
            </div>
            
            {/* Language Distribution Card */}
            {project.languages && Object.keys(project.languages).length > 0 && (
              <div className="enterprise-card p-6 shadow-xs">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-text mb-3">Language Distribution</h3>
                <div className="flex flex-wrap gap-2.5">
                  {Object.entries(project.languages).map(([lang, count]) => {
                    const getLangColor = (l) => {
                      if (l === 'PHP') return 'bg-tech-php-text';
                      if (l === 'JavaScript') return 'bg-tech-js-text';
                      if (l === 'TypeScript') return 'bg-tech-ng-text';
                      if (l === 'Python') return 'bg-amber-500';
                      if (l === 'HTML') return 'bg-orange-500';
                      if (l === 'CSS') return 'bg-blue-500';
                      if (l === 'C#') return 'bg-purple-600';
                      return 'bg-muted-text';
                    };
                    return (
                      <span 
                        key={lang}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 bg-light-gray/40 dark:bg-dark-bg/40 border border-border-muted rounded-xl text-xs font-semibold text-foreground"
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${getLangColor(lang)}`}></span>
                        <span>{lang}:</span>
                        <span className="font-bold text-primary-purple">{count} {count === 1 ? 'file' : 'files'}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remaining APIs Report Section */}
            {project.completed_with_warnings && project.remaining_apis && Object.keys(project.remaining_apis).length > 0 && (
              <div className="enterprise-card p-6 shadow-xs border border-rose-500/30 bg-rose-500/5 mt-8">
                <h3 className="text-lg font-bold text-foreground mb-4 text-rose-500">Remaining Deprecated APIs</h3>
                <p className="text-sm text-muted-text mb-4">
                  The following APIs were not migrated automatically and require manual intervention or custom rule creation:
                </p>
                <div className="bg-neutral-950 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-60 border border-neutral-800">
                  <table className="w-full text-left text-neutral-300">
                    <tbody>
                      {Object.entries(project.remaining_apis).sort((a, b) => b[1] - a[1]).map(([api, count]) => (
                        <tr key={api} className="border-b border-neutral-800 last:border-0">
                          <td className="py-2 text-rose-400 font-semibold">{api}</td>
                          <td className="py-2 text-right">{".".repeat(Math.max(2, 30 - api.length))} {count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {project.remaining_apis_details && project.remaining_apis_details.length > 0 && (
                  <div className="mt-4 bg-neutral-950 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-60 border border-neutral-800">
                    <h4 className="text-rose-400 font-bold mb-2">Detailed Occurrences:</h4>
                    <table className="w-full text-left text-neutral-300">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-500">
                          <th className="pb-2">API</th>
                          <th className="pb-2">File</th>
                          <th className="pb-2 text-right">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.remaining_apis_details.map((detail, idx) => (
                          <tr key={idx} className="border-b border-neutral-800/50 last:border-0 hover:bg-neutral-900">
                            <td className="py-1.5 text-rose-400 font-semibold">{detail.api}</td>
                            <td className="py-1.5 opacity-80 break-all pl-2">{detail.file}</td>
                            <td className="py-1.5 text-right">{detail.line}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            
            {/* Rule Diagnostics Section */}
            {project.rule_diagnostics && Object.keys(project.rule_diagnostics).length > 0 && (
              <div className="enterprise-card p-6 shadow-xs border border-primary-purple/20 bg-primary-purple/5 mt-8">
                <h3 className="text-lg font-bold text-foreground mb-4 text-primary-purple">Migration Rule Diagnostics</h3>
                <p className="text-sm text-muted-text mb-4">
                  Detailed performance of the rule engine transformations.
                </p>
                <div className="bg-neutral-950 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-80 border border-neutral-800">
                  <table className="w-full text-left text-neutral-300">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-500">
                        <th className="pb-2">Rule</th>
                        <th className="pb-2 text-right">Found</th>
                        <th className="pb-2 text-right text-emerald-400">Migrated</th>
                        <th className="pb-2 text-right text-rose-400">Skipped</th>
                        <th className="pb-2 pl-4">Reason Skipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(project.rule_diagnostics).sort((a, b) => b[1].found - a[1].found).map(([rule, stats]) => (
                        <tr key={rule} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-900">
                          <td className="py-2 font-semibold text-primary-purple">{rule}</td>
                          <td className="py-2 text-right">{stats.found}</td>
                          <td className="py-2 text-right text-emerald-400">{stats.migrated}</td>
                          <td className="py-2 text-right text-rose-400">{stats.skipped}</td>
                          <td className="py-2 pl-4 text-rose-300 text-[10px]">
                            {stats.reasons && stats.reasons.length > 0 
                              ? [...new Set(stats.reasons)].join(", ") 
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
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
                        strokeDashoffset={251.2 - (251.2 * animatedScore) / 100}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-xl font-extrabold text-foreground">
                      {animatedScore}%
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

        {/* Visual Diffs Section */}
        {project.upgraded && project.migration_diffs && project.migration_diffs.length > 0 && (
          <div className="enterprise-card p-6 shadow-xs mt-8">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center space-x-2">
              <Code className="h-5 w-5 text-primary-purple" />
              <span>Modernization Code Diffs ({project.upgraded_files_count || project.migration_diffs.length} files modified)</span>
            </h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {project.migration_diffs.map((d, index) => (
                <div key={index} className="border border-border-muted rounded-xl overflow-hidden">
                  <div className="bg-surface-muted px-4 py-2.5 text-xs font-mono font-bold text-foreground border-b border-border-muted flex justify-between">
                    <span>{d.file}</span>
                  </div>
                  <pre className="p-4 bg-neutral-950 text-[11px] font-mono text-neutral-200 overflow-x-auto whitespace-pre-wrap select-text max-h-[300px]">
                    {d.diff}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
