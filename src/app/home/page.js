'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';
import { 
  Upload, File, X, Sparkles, CheckCircle2, RefreshCw, AlertTriangle, 
  ArrowRight, ShieldCheck, Cpu, Database, Play, ArrowLeft, ChevronRight,
  Code, Server, Terminal, Layout
} from 'lucide-react';

const VERSIONS_MAP = {
  'PHP': [
    'PHP 5.0', 'PHP 5.2', 'PHP 5.3', 'PHP 5.4', 'PHP 5.5', 'PHP 5.6', 
    'PHP 7.0', 'PHP 7.1', 'PHP 7.2', 'PHP 7.3', 'PHP 7.4', 
    'PHP 8.0', 'PHP 8.1', 'PHP 8.2', 'PHP 8.3', 'PHP 8.4'
  ],
  'Node.js': [
    'Node 8', 'Node 10', 'Node 12', 'Node 14', 'Node 16', 'Node 18', 'Node 20'
  ],
  'Angular': [
    'Angular 2', 'Angular 4', 'Angular 6', 'Angular 8', 'Angular 10', 
    'Angular 12', 'Angular 14', 'Angular 15', 'Angular 16', 'Angular 17', 'Angular 18'
  ],
  '.NET': [
    '.NET Framework 3.5', '.NET Framework 4.0', '.NET Framework 4.5', 
    '.NET Framework 4.6', '.NET Framework 4.7', '.NET Framework 4.8', 
    '.NET Core 3.1', '.NET 5', '.NET 6', '.NET 7', '.NET 8'
  ],
  'VB.NET': [
    'VB 6.0', 'VB.NET 2002', 'VB.NET 2003', 'VB.NET 2005', 'VB.NET 2008',
    'VB.NET 2010', 'VB.NET 2012', 'VB.NET 2015', 'VB.NET 2019',
    '.NET 5 (VB)', '.NET 6 (VB)', '.NET 7 (VB)', '.NET 8 (VB)'
  ]
};

const FRAMEWORKS_MAP = {
  'PHP': ['Laravel', 'Symfony', 'WordPress', 'Core PHP'],
  'Node.js': ['Express', 'NestJS', 'Next.js', 'Vanilla Node'],
  'Angular': ['Angular CLI', 'Nx Monorepo', 'Vanilla Angular'],
  '.NET': ['ASP.NET MVC', 'ASP.NET WebForms', 'ASP.NET Core', 'WPF / WinForms'],
  'VB.NET': ['WinForms', 'WPF', 'ASP.NET WebForms', 'Console Application']
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Route protection
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // Form states
  const [step, setStep] = useState('upload'); // 'upload' | 'configure'
  const [projectName, setProjectName] = useState('');
  const [selectedTech, setSelectedTech] = useState('');
  const [techStack, setTechStack] = useState('PHP');
  const [framework, setFramework] = useState('');
  const [currentVersion, setCurrentVersion] = useState('PHP 5.4');
  const [targetVersion, setTargetVersion] = useState('PHP 8.3');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');
  const [uploadSummary, setUploadSummary] = useState(null);
  const [selectedTargetVersion, setSelectedTargetVersion] = useState('PHP 8.3');
  const [selectedFramework, setSelectedFramework] = useState('No framework');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('');
  const [estimatedMigrationSec, setEstimatedMigrationSec] = useState(45);
  const [remainingMigrationSec, setRemainingMigrationSec] = useState(45);

  // Recent migrations live state
  const [recentMigrations, setRecentMigrations] = useState([]);

  useEffect(() => {
    if (status === 'authenticated') {
      const fetchRecent = async () => {
        try {
          const response = await axios.get('/api/project/list');
          setRecentMigrations(response.data.slice(0, 3));
        } catch (err) {
          console.error('Error fetching recent migrations:', err);
        }
      };

      fetchRecent();
      const interval = setInterval(fetchRecent, 3000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!uploadSummary) {
      setSelectedTargetVersion('PHP 8.3');
      setSelectedFramework('No framework');
      setEstimatedTime('');
      setEstimatedMigrationSec(45);
      setRemainingMigrationSec(45);
      setCurrentVersion('PHP 5.6');
      return;
    }

    setCurrentVersion(uploadSummary.current_version || 'PHP 5.6');
    const versions = uploadSummary.supported_versions || ['PHP 7.4', 'PHP 8.0', 'PHP 8.1', 'PHP 8.2', 'PHP 8.3'];
    setSelectedTargetVersion(versions[versions.length - 1] || 'PHP 8.3');

    const frameworks = uploadSummary.framework_options || ['Laravel', 'Symfony', 'WordPress', 'Core PHP', 'No framework'];
    setSelectedFramework(frameworks.includes('No framework') ? 'No framework' : frameworks[0]);

    const candidateCount = uploadSummary.migration_candidates?.length || 1;
    const fileCount = uploadSummary.total_files || 5;
    const estimatedSec = Math.max(20, Math.min(120, candidateCount * 8 + Math.ceil(fileCount / 4) * 5));
    
    setEstimatedMigrationSec(estimatedSec);
    setRemainingMigrationSec(estimatedSec);
    const minutes = Math.max(1, Math.ceil(estimatedSec / 60));
    setEstimatedTime(estimatedSec < 60 ? `${estimatedSec} sec` : `${minutes} min`);
  }, [uploadSummary]);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadSuccessMessage('');
    setUploadSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Step 1: Upload ZIP file handler
  const handleUploadZip = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }

    if (!file) {
      setError('Please select or upload a PHP project ZIP file.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('user_name', session?.user?.name || 'Authorized User');
      formData.append('project_name', projectName.trim());
      formData.append('technology', 'PHP');
      formData.append('file', file);

      const response = await axios.post('/api/project/temp-save', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      const newProject = response.data;
      setUploadSummary(newProject.analysis || null);
      setUploadSuccessMessage('ZIP file successfully uploaded!');
      setError('');
      setIsSubmitting(false);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Failed to upload ZIP file. Please try again.';
      setError(errMsg);
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Step 2: Approve & Start Migration
  const handleConfirmMigration = async () => {
    if (!uploadSummary) return;
    const projectId = uploadSummary.projectId || uploadSummary.id || projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    setIsSubmitting(true);
    const totalSec = estimatedMigrationSec || 45;
    setRemainingMigrationSec(totalSec);

    const timer = setInterval(() => {
      setRemainingMigrationSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const response = await axios.post(`/api/project/${projectId}/upgrade`, {
        targetVersion: selectedTargetVersion,
        framework: selectedFramework
      });
      clearInterval(timer);
      setRemainingMigrationSec(0);
      if (response.data?.success) {
        router.push(`/projects/${projectId}`);
      } else {
        setError(response.data?.error || 'Migration could not be completed.');
        setIsSubmitting(false);
      }
    } catch (err) {
      clearInterval(timer);
      console.error(err);
      setError(err.response?.data?.error || 'Migration could not be completed.');
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-purple border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden transition-colors duration-300">
      <Navbar />

      <main className="flex-grow flex items-center justify-center px-6 lg:px-8 py-6 h-[calc(100vh-64px)] max-h-[900px] overflow-hidden">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full max-h-[720px]">
          
          {/* LEFT COLUMN: Branding & Recent Migrations */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full py-4 space-y-6">
            
            {/* Branding Header */}
            <div className="space-y-4">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-primary-purple/10 text-primary-purple rounded-full text-[10px] font-bold tracking-wider uppercase">
                <Sparkles className="h-3 w-3" />
                <span>Next-Gen Migration Engine</span>
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight bg-gradient-to-r from-foreground via-foreground to-primary-purple bg-clip-text">
                Modernize PHP legacy systems intelligently.
              </h1>
              <p className="text-xs sm:text-sm text-muted-text leading-relaxed">
                Upload your PHP codebase ZIP archive. Inspect codebase statistics, auto-detect PHP versions, choose your target landing version and framework, and start automated migration.
              </p>
              
              {/* Feature Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="flex items-center space-x-1.5 px-3 py-1 bg-surface-muted border border-border-muted/80 rounded-lg text-[11px] font-medium text-foreground">
                  <Database className="h-3.5 w-3.5 text-primary-purple" />
                  <span>PHP Auto-Detection</span>
                </span>
                <span className="flex items-center space-x-1.5 px-3 py-1 bg-surface-muted border border-border-muted/80 rounded-lg text-[11px] font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Configurable Landing Version</span>
                </span>
              </div>
            </div>

            {/* Recent Migrations List */}
            <div className="space-y-3 flex-grow flex flex-col justify-end">
              <div className="flex items-center justify-between border-b border-border-muted/60 pb-2">
                <h3 className="text-[11px] font-bold tracking-wider text-muted-text uppercase">
                  Recent Migrations
                </h3>
                <span className="text-[10px] font-bold text-primary-purple cursor-pointer hover:underline" onClick={() => router.push('/projects')}>
                  View all
                </span>
              </div>
              
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {recentMigrations.length === 0 ? (
                  <div className="p-4 bg-surface-muted/30 border border-border-muted/50 rounded-xl text-center">
                    <p className="text-[11px] text-muted-text">No migrations found. Upload a project file to start.</p>
                  </div>
                ) : (
                  recentMigrations.map((migration) => {
                    const getStatusBadgeStyle = (status) => {
                      const norm = status?.toLowerCase();
                      if (norm === 'completed') {
                        return 'bg-emerald-100/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50';
                      }
                      if (norm === 'failed') {
                        return 'bg-rose-100/80 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50';
                      }
                      return 'bg-primary-purple/10 text-primary-purple border-primary-purple/20 animate-pulse';
                    };

                    const isInProgress = migration.status !== 'Completed' && migration.status !== 'Failed';

                    return (
                      <div 
                        key={migration.id}
                        onClick={() => router.push(`/projects/${migration.id}`)}
                        className="flex items-center justify-between p-3 bg-card-bg hover:bg-surface-muted border border-border-muted hover:border-primary-purple/30 cursor-pointer rounded-xl transition-all duration-200 group"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary-purple/10 text-primary-purple flex items-center justify-center font-bold text-xs shrink-0">
                            PHP
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary-purple transition-colors duration-150">
                              {migration.project_name}
                            </h4>
                            <p className="text-[10px] text-muted-text truncate">
                              {migration.current_version} → {migration.target_version}
                            </p>
                            {isInProgress && (
                              <p className="text-[9px] font-semibold text-primary-purple truncate">
                                Remaining: {migration.formatted_remaining_time || '0s'} left (Est: {migration.formatted_estimated_time || '55s'})
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeStyle(migration.status)}`}>
                          {migration.status === 'Scanning' ? 'Scanning...' : migration.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive 2-Step Form */}
          <div className="lg:col-span-7 flex flex-col justify-center py-4">
            <div className="bg-card-bg/60 backdrop-blur-md border border-border-muted/80 shadow-2xl rounded-3xl p-6 sm:p-8 space-y-5">
              
              {/* Header with Step Indicator */}
              <div className="flex items-center justify-between border-b border-border-muted/60 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-primary-purple/10 text-primary-purple flex items-center justify-center font-bold">
                    {step === 'upload' ? <Upload className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-foreground">
                      {step === 'upload' ? '1. Upload Codebase ZIP' : '2. Review & Select Landing Version'}
                    </h2>
                    <p className="text-[10px] text-muted-text">
                      {step === 'upload' ? 'Upload PHP project archive to begin' : 'Inspect file/line metrics & configure target stack'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    step === 'upload' ? 'bg-primary-purple text-white' : 'bg-surface-muted text-muted-text'
                  }`}>
                    Step 1
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-text" />
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    step === 'configure' ? 'bg-primary-purple text-white' : 'bg-surface-muted text-muted-text'
                  }`}>
                    Step 2
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-start space-x-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: UPLOAD FORM */}
              {step === 'upload' && (
                <form onSubmit={handleUploadZip} className="space-y-5">
                  {/* Project Name */}
                  <div className="space-y-1.5">
                    <label htmlFor="projectName" className="text-xs font-bold uppercase tracking-wider text-muted-text">
                      Project Name
                    </label>
                    <input
                      id="projectName"
                      type="text"
                      placeholder="e.g. Core Billing Portal"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full pl-4 pr-4 py-3 rounded-xl border border-border-muted focus:border-primary-purple bg-background/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary-purple/20 transition-all duration-200"
                    />
                  </div>

                  {/* Drag & Drop File Upload */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-text">
                      PHP Codebase ZIP File
                    </label>
                    
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current.click()}
                      className={`border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                        dragActive 
                          ? 'border-primary-purple bg-primary-purple/5' 
                          : 'border-border-muted/80 hover:border-primary-purple bg-background/30 hover:bg-surface-muted/40'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      
                      {!file ? (
                        <div className="space-y-2">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary-purple/10 text-primary-purple">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              Drag & drop PHP codebase archive here
                            </p>
                            <p className="text-[10px] text-muted-text mt-0.5">
                              Supports standard .zip files
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 bg-surface-muted rounded-xl border border-border-muted text-left">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="h-8 w-8 shrink-0 bg-primary-purple/10 text-primary-purple rounded-lg flex items-center justify-center">
                              <File className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-muted-text">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile();
                            }}
                            className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/40 hover:text-rose-600 rounded-lg text-muted-text transition-colors duration-150 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload Success Message Banner */}
                  {uploadSuccessMessage && (
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                        <span className="font-bold">{uploadSuccessMessage}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase bg-emerald-600/10 px-2 py-0.5 rounded">Ready</span>
                    </div>
                  )}

                  {/* Upload Progress Bar */}
                  {isSubmitting && uploadProgress > 0 && !uploadSuccessMessage && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[10px] font-bold text-muted-text uppercase tracking-wider">
                        <span>Uploading Archive...</span>
                        <span className="text-primary-purple">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-surface-muted h-2 rounded-full overflow-hidden border border-border-muted/50">
                        <div 
                          className="bg-primary-purple h-full transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Upload Action Buttons */}
                  <div className="pt-2 flex items-center space-x-3">
                    {!uploadSuccessMessage ? (
                      <button
                        type="submit"
                        disabled={isSubmitting || !file || !projectName.trim()}
                        className="w-full relative flex items-center justify-center space-x-2 py-3.5 bg-primary-purple hover:bg-hover-purple disabled:bg-primary-purple/60 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all duration-200 cursor-pointer shadow-md shadow-primary-purple/20"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                            <span>Uploading ZIP…</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4.5 w-4.5" />
                            <span>Upload ZIP</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStep('configure')}
                        className="w-full relative flex items-center justify-center space-x-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all duration-200 cursor-pointer shadow-md shadow-emerald-600/20"
                      >
                        <span>Next</span>
                        <ArrowRight className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* STEP 2: CODEBASE INSPECTION & USER APPROVAL CONFIGURATION */}
              {step === 'configure' && uploadSummary && (
                <div className="space-y-4">
                  {/* Summary Banner */}
                  <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-300">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold">Codebase successfully inspected</span>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">{uploadSummary.fileName || file?.name || 'Project archive'} ready for configuration.</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary-purple/10 text-primary-purple text-[10px] font-bold">
                      Est. Time: {estimatedMigrationSec}s
                    </span>
                  </div>

                  {/* Auto-detected Current Version & Metrics Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-border-muted bg-background/50">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-text">Auto-Detected Version</p>
                      <select
                        value={currentVersion}
                        onChange={(e) => setCurrentVersion(e.target.value)}
                        className="w-full bg-transparent text-sm font-extrabold text-primary-purple mt-0.5 outline-none cursor-pointer"
                      >
                        {VERSIONS_MAP[techStack]?.map(v => (
                          <option key={v} value={v} className="text-foreground bg-background">{v}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3 rounded-xl border border-border-muted bg-background/50">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-text">Total Codebase</p>
                      <p className="text-sm font-extrabold text-foreground mt-0.5">
                        {uploadSummary.total_files || 0} files ({uploadSummary.total_lines || 0} lines)
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-border-muted bg-background/50">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-text">Can Be Migrated</p>
                      <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {uploadSummary.migration_candidates?.length || 0} file(s) flagged
                      </p>
                    </div>
                  </div>

                  {/* Target PHP Version Selection (Landing Version) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                      <span>Target Landing Version (PHP Only)</span>
                      <span className="text-[10px] text-primary-purple font-semibold">Configurable</span>
                    </label>
                    <select
                      value={selectedTargetVersion}
                      disabled={isSubmitting}
                      onChange={(e) => setSelectedTargetVersion(e.target.value)}
                      className="w-full rounded-xl border border-border-muted bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary-purple"
                    >
                      {(uploadSummary.supported_versions || ['PHP 7.4', 'PHP 8.0', 'PHP 8.1', 'PHP 8.2', 'PHP 8.3', 'PHP 8.4']).map((ver) => (
                        <option key={ver} value={ver}>{ver}</option>
                      ))}
                    </select>
                  </div>

                  {/* Framework Options */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Framework Option
                    </label>
                    <select
                      value={selectedFramework}
                      disabled={isSubmitting}
                      onChange={(e) => setSelectedFramework(e.target.value)}
                      className="w-full rounded-xl border border-border-muted bg-background px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary-purple"
                    >
                      {(uploadSummary.framework_options || ['Laravel', 'Symfony', 'WordPress', 'Core PHP', 'No framework']).map((fw) => (
                        <option key={fw} value={fw}>{fw}</option>
                      ))}
                    </select>
                  </div>

                  {/* Flagged Migration Candidates Preview */}
                  <div className="p-3 rounded-xl border border-border-muted bg-background/40 max-h-[100px] overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-text mb-1.5">
                      Files Ready for Migration ({uploadSummary.migration_candidates?.length || 0})
                    </p>
                    {(!uploadSummary.migration_candidates || uploadSummary.migration_candidates.length === 0) ? (
                      <p className="text-[11px] text-muted-text">No legacy syntax errors found. Codebase is clean.</p>
                    ) : (
                      <ul className="space-y-1 text-[11px]">
                        {uploadSummary.migration_candidates.slice(0, 4).map((cand, idx) => (
                          <li key={idx} className="flex items-center text-foreground truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 shrink-0" />
                            <span className="font-semibold truncate mr-2">{cand.path}</span>
                            <span className="text-[10px] text-muted-text shrink-0">({cand.reason})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Live Migration Progress Box while submitting */}
                  {isSubmitting && (
                    <div className="p-4 bg-primary-purple/10 border border-primary-purple/30 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="flex items-center space-x-2 text-primary-purple">
                          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                          <span>Migrating codebase to {selectedTargetVersion}...</span>
                        </span>
                        <span className="px-2 py-0.5 bg-primary-purple text-white text-[10px] font-extrabold rounded-md font-mono">
                          {remainingMigrationSec}s remaining
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-surface-muted h-2.5 rounded-full overflow-hidden border border-border-muted/50">
                        <div 
                          className="bg-primary-purple h-full transition-all duration-1000 ease-linear rounded-full"
                          style={{
                            width: `${Math.min(98, Math.max(8, Math.round(((estimatedMigrationSec - remainingMigrationSec) / estimatedMigrationSec) * 100)))}%`
                          }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-muted-text font-medium">
                        <span>Total Estimated: {estimatedMigrationSec}s</span>
                        <span className="font-bold text-foreground">Time Left: {remainingMigrationSec}s</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setStep('upload')}
                      disabled={isSubmitting}
                      className="px-4 py-3 border border-border-muted text-foreground font-bold text-xs rounded-xl hover:bg-surface-muted transition-all duration-150 cursor-pointer disabled:opacity-50"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmMigration}
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center space-x-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs tracking-wider uppercase rounded-xl transition-all duration-200 cursor-pointer shadow-md shadow-emerald-600/20"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                          <span>Migrating ({remainingMigrationSec}s left)...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4.5 w-4.5" />
                          <span>Approve & Start Migration ({selectedTargetVersion})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
