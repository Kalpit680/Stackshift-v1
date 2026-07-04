'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';
import { 
  Upload, File, X, Sparkles, CheckCircle2, RefreshCw, AlertTriangle, 
  ArrowRight, ShieldCheck, Cpu, Database, Play 
} from 'lucide-react';

const VERSIONS_MAP = {
  'PHP': [
    'PHP 5.0', 'PHP 5.2', 'PHP 5.3', 'PHP 5.4', 'PHP 5.5', 'PHP 5.6', 
    'PHP 7.0', 'PHP 7.1', 'PHP 7.2', 'PHP 7.3', 'PHP 7.4', 
    'PHP 8.0', 'PHP 8.1', 'PHP 8.2', 'PHP 8.3'
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
  ]
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
  const [projectName, setProjectName] = useState('');
  const [techStack, setTechStack] = useState('PHP');
  const [currentVersion, setCurrentVersion] = useState('PHP 5.4');
  const [targetVersion, setTargetVersion] = useState('PHP 8.3');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Dynamic dropdown version filtering & autofill
  useEffect(() => {
    const versions = VERSIONS_MAP[techStack] || [];
    if (versions.length > 0) {
      // Set default current version to a middle-legacy value
      let defaultCurrent = versions[0];
      if (techStack === 'PHP') defaultCurrent = 'PHP 5.4';
      if (techStack === 'Node.js') defaultCurrent = 'Node 12';
      if (techStack === 'Angular') defaultCurrent = 'Angular 8';
      if (techStack === '.NET') defaultCurrent = '.NET Framework 4.5';
      
      setCurrentVersion(defaultCurrent);
      updateTargetVersions(techStack, defaultCurrent);
    }
  }, [techStack]);

  const handleCurrentVersionChange = (e) => {
    const selected = e.target.value;
    setCurrentVersion(selected);
    updateTargetVersions(techStack, selected);
  };

  const updateTargetVersions = (tech, currentVal) => {
    const versions = VERSIONS_MAP[tech] || [];
    const currentIndex = versions.indexOf(currentVal);
    const availableTargets = versions.slice(currentIndex + 1);
    
    if (availableTargets.length > 0) {
      // Autofill the latest stable version (last element)
      setTargetVersion(availableTargets[availableTargets.length - 1]);
    } else {
      setTargetVersion('');
    }
  };

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

  // Form submit handler
  const handleStartMigration = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }
    
    if (!file) {
      setError('Please upload your legacy application project file.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('user_name', session?.user?.name || 'Authorized User');
      formData.append('project_name', projectName.trim());
      formData.append('file', file); // The actual ZIP file binary

      const response = await axios.post('/api/project/temp-save', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const newProject = response.data;
      
      // Redirect to the live migration status page
      router.push(`/projects/${newProject.id}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit migration request. Please try again.');
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

  // Get available target versions
  const versions = VERSIONS_MAP[techStack] || [];
  const currentIndex = versions.indexOf(currentVersion);
  const targetVersions = versions.slice(currentIndex + 1);

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* LEFT COLUMN: Branding & Recent Migrations */}
        <section className="lg:col-span-5 flex flex-col space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
              Modernize legacy systems with intelligence.
            </h1>
            <p className="text-lg text-muted-text max-w-md">
              Upgrade your current applications safely and intelligently within the same technology stack.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2.5">
            <span className="flex items-center space-x-1.5 px-4 py-2 bg-card-bg text-primary-purple rounded-full border border-border-muted text-xs font-semibold shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI-assisted</span>
            </span>
            <span className="flex items-center space-x-1.5 px-4 py-2 bg-card-bg text-primary-purple rounded-full border border-border-muted text-xs font-semibold shadow-sm">
              <Database className="h-3.5 w-3.5" />
              <span>Version-aware</span>
            </span>
            <span className="flex items-center space-x-1.5 px-4 py-2 bg-card-bg text-primary-purple rounded-full border border-border-muted text-xs font-semibold shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Safe migration</span>
            </span>
            <span className="flex items-center space-x-1.5 px-4 py-2 bg-card-bg text-primary-purple rounded-full border border-border-muted text-xs font-semibold shadow-sm">
              <Cpu className="h-3.5 w-3.5" />
              <span>Auto recommendations</span>
            </span>
          </div>

          {/* Recent Migrations */}
          <div className="border-t border-border-muted pt-8 space-y-4">
            <h3 className="text-sm font-semibold tracking-wider text-muted-text uppercase">
              Recent Migrations
            </h3>
            
            <div className="space-y-3">
              {recentMigrations.length === 0 ? (
                <p className="text-xs text-muted-text py-4">No recent migrations found. Configure a project on the right to start.</p>
              ) : (
                recentMigrations.map((migration) => {
                  const getTechAbbrev = (tech) => {
                    if (tech === 'PHP') return 'PHP';
                    if (tech === 'Node.js') return 'JS';
                    if (tech === 'Angular') return 'NG';
                    if (tech === '.NET') return 'NET';
                    return tech?.substring(0, 3).toUpperCase();
                  };

                  const getTechColorClass = (tech) => {
                    if (tech === 'PHP') return 'bg-tech-php-bg text-tech-php-text';
                    if (tech === 'Node.js') return 'bg-tech-js-bg text-tech-js-text';
                    if (tech === 'Angular') return 'bg-tech-ng-bg text-tech-ng-text';
                    if (tech === '.NET') return 'bg-tech-net-bg text-tech-net-text';
                    return 'bg-surface-muted text-muted-text';
                  };

                  const getStatusBadgeStyle = (status) => {
                    const norm = status?.toLowerCase();
                    if (norm === 'completed') {
                      return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400';
                    }
                    if (norm === 'failed') {
                      return 'bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-400';
                    }
                    if (norm === 'pending') {
                      return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400';
                    }
                    // Scanning / Analyzing
                    return 'bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-400 animate-pulse';
                  };

                  return (
                    <div 
                      key={migration.id}
                      onClick={() => router.push(`/projects/${migration.id}`)}
                      className="flex items-center justify-between p-4 bg-card-bg rounded-2xl border border-border-muted hover:border-border-color cursor-pointer transition-all duration-200 shadow-xs group"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${getTechColorClass(migration.technology)}`}>
                          {getTechAbbrev(migration.technology)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary-purple transition-colors duration-150">
                            {migration.project_name}
                          </h4>
                          <p className="text-xs text-muted-text">
                            {migration.current_version} → {migration.target_version}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium border border-transparent ${getStatusBadgeStyle(migration.status)}`}>
                        {migration.status === 'Scanning' ? 'Scanning...' : migration.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Configuration Form */}
        <section className="lg:col-span-7">
          <form 
            onSubmit={handleStartMigration} 
            className="enterprise-card p-8 md:p-10 shadow-lg transition-all duration-300"
          >
            <div className="space-y-6">
              
              <div>
                <h2 className="text-2xl font-bold text-foreground">Migration Configurator</h2>
                <p className="text-sm text-muted-text mt-1">Specify source codebase structure and target requirements.</p>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl text-sm text-rose-700 dark:text-rose-400 flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Project Name */}
              <div className="space-y-2">
                <label htmlFor="projectName" className="text-sm font-semibold text-foreground">
                  Project Name
                </label>
                <input
                  id="projectName"
                  type="text"
                  placeholder="e.g. My Legacy Portal"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full enterprise-input focus:ring-2 focus:ring-primary-purple/20 transition-all duration-200 text-sm font-medium py-3 px-4 rounded-xl border border-border-color"
                />
              </div>

              {/* 2. Current Stack */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="techStack" className="text-sm font-semibold text-foreground">
                    Current Stack
                  </label>
                  <select
                    id="techStack"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    className="w-full enterprise-input text-sm font-medium py-3 px-4 rounded-xl border border-border-color"
                  >
                    <option value="PHP">PHP</option>
                    <option value="Node.js">Node.js</option>
                    <option value="Angular">Angular</option>
                    <option value=".NET">.NET</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="currentVersion" className="text-sm font-semibold text-foreground">
                    Current Version
                  </label>
                  <select
                    id="currentVersion"
                    value={currentVersion}
                    onChange={handleCurrentVersionChange}
                    className="w-full enterprise-input text-sm font-medium py-3 px-4 rounded-xl border border-border-color"
                  >
                    {(VERSIONS_MAP[techStack] || []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Target Stack */}
              <div className="space-y-2">
                <label htmlFor="targetVersion" className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span>Target Version</span>
                  <span className="text-xs text-primary-purple bg-primary-purple/10 px-2.5 py-0.5 rounded-full font-bold">
                    Recommended Autofill
                  </span>
                </label>
                <select
                  id="targetVersion"
                  value={targetVersion}
                  onChange={(e) => setTargetVersion(e.target.value)}
                  className="w-full enterprise-input text-sm font-medium py-3 px-4 rounded-xl border border-border-color"
                  disabled={targetVersions.length === 0}
                >
                  {targetVersions.length > 0 ? (
                    targetVersions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))
                  ) : (
                    <option value="">No higher versions available</option>
                  )}
                </select>
              </div>

              {/* 4. Upload Project */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  Upload Project (Source ZIP)
                </label>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
                  className={`border-2 border-dashed rounded-[20px] p-6 text-center cursor-pointer transition-all duration-200 ${
                    dragActive 
                      ? 'border-primary-purple bg-primary-purple/5' 
                      : 'border-border-color hover:border-primary-purple/80 hover:bg-bg-hover'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,.tar,.gz,.tgz"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  
                  {!file ? (
                    <div className="space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-purple/10 text-primary-purple">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          Drag & drop project zip here
                        </p>
                        <p className="text-xs text-muted-text mt-1">
                          or click to browse from local computer
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3.5 bg-surface-muted rounded-xl border border-border-muted text-left">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="h-10 w-10 shrink-0 bg-primary-purple/10 text-primary-purple rounded-lg flex items-center justify-center">
                          <File className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-text mt-0.5">
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
                        className="p-1.5 hover:bg-rose-100 hover:text-rose-600 rounded-lg text-muted-text transition-colors duration-150 cursor-pointer"
                      >
                        <X className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Start Migration Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full relative flex items-center justify-center space-x-2 py-4 bg-primary-purple hover:bg-hover-purple disabled:bg-primary-purple/60 text-white font-bold text-base rounded-[20px] transition-all duration-200 cursor-pointer shadow-md shadow-primary-purple/20"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Initiating scanner pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      <span>Start Migration</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </form>
        </section>

      </main>
    </div>
  );
}
