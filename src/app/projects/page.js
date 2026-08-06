'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';
import { 
  Search, Eye, Trash2, Download, ExternalLink, Calendar,
  ArrowRight, ShieldCheck, ChevronRight, RefreshCw, AlertCircle
} from 'lucide-react';

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Route protection
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // States
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [isDeleting, setIsDeleting] = useState(null);

  // Fetch migrations list
  const fetchProjects = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Fetch all projects (including system seeds for review)
      const response = await axios.get('/api/project/list');
      setProjects(response.data);
    } catch (err) {
      console.error('Error fetching migrations:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProjects(true);

      // Setup dynamic polling interval to update status states live
      const interval = setInterval(() => {
        fetchProjects(false);
      }, 3500);

      return () => clearInterval(interval);
    }
  }, [status]);

  // Delete handler
  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the migration history for "${name}"?`)) {
      return;
    }
    
    setIsDeleting(id);
    try {
      await axios.delete(`/api/project/${id}`);
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Download report handler (creates a real client-side text file download)
  const handleDownloadReport = (project) => {
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

  // Filtering & search logic
  const filteredProjects = projects.filter((project) => {
    // Search filter
    const matchesSearch = 
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.technology?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status pill filter
    if (activeFilter === 'All') return matchesSearch;
    
    // Status mappings
    const currentStatus = project.status?.toLowerCase();
    
    if (activeFilter === 'Completed') return matchesSearch && (currentStatus === 'completed' || currentStatus === 'migrated');
    if (activeFilter === 'Scanning') return matchesSearch && currentStatus === 'scanning';
    if (activeFilter === 'Pending') return matchesSearch && currentStatus === 'pending';
    if (activeFilter === 'Failed') return matchesSearch && currentStatus === 'failed';
    
    // If analyzing / checking compatibility etc. let's treat as scanning or analyzing
    if (activeFilter === 'Scanning') {
      return matchesSearch && (currentStatus === 'scanning' || currentStatus === 'analyzing');
    }

    return matchesSearch;
  });

  const getStatusStyle = (statusName) => {
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

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (status === 'loading' || (loading && projects.length === 0)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-purple border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-text">Loading migrations history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-12 md:py-16 space-y-8">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Migration History
            </h1>
            <p className="text-base text-muted-text">
              Track your previous migrations and reports.
            </p>
          </div>
        </div>

        {/* Controls: Search and filter pills */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card-bg p-4 rounded-[20px] border border-border-muted shadow-xs">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
            <input
              type="text"
              placeholder="Search by project name or stack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-muted bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary-purple focus:ring-2 focus:ring-primary-purple/20 transition-all duration-200"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
            {['All', 'Completed', 'Scanning', 'Pending', 'Failed'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 text-xs font-bold rounded-full border transition-all duration-200 cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-primary-purple text-white border-primary-purple shadow-sm'
                    : 'bg-background text-muted-text border-border-muted hover:border-primary-purple/40 hover:text-foreground'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

        </div>

        {/* Migrations Table / Grid */}
        <div className="bg-card-bg rounded-[24px] border border-border-muted shadow-sm overflow-hidden transition-all duration-300">
          {filteredProjects.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-purple/10 text-primary-purple mb-4">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No migrations found</h3>
              <p className="text-sm text-muted-text mt-1 max-w-sm mx-auto">
                No migration records matched your filters. Adjust filters or configure a new migration from the home panel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-muted text-xs font-bold tracking-wider text-muted-text uppercase bg-surface-muted/50">
                    <th className="px-6 py-4.5">Project Name</th>
                    <th className="px-6 py-4.5">Technology</th>
                    <th className="px-6 py-4.5">Current Version</th>
                    <th className="px-6 py-4.5">Target Version</th>
                    <th className="px-6 py-4.5">Status</th>
                    <th className="px-6 py-4.5">Created</th>
                    <th className="px-6 py-4.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {filteredProjects.map((project) => (
                    <tr 
                      key={project.id}
                      className="hover:bg-bg-hover/40 transition-colors duration-150"
                    >
                      <td className="px-6 py-4.5 font-bold text-foreground text-sm">
                        {project.project_name}
                      </td>
                      <td className="px-6 py-4.5">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md ${getTechColorClass(project.technology)}`}>
                          {project.technology}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-sm font-medium text-muted-text">
                        {project.current_version}
                      </td>
                      <td className="px-6 py-4.5 text-sm font-medium text-muted-text">
                        {project.target_version}
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="flex flex-col">
                          <span className={`inline-flex items-center w-max px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusStyle(project.status)}`}>
                            {project.status === 'Scanning' ? 'Scanning...' : project.status}
                          </span>
                          {project.status !== 'Completed' && project.status !== 'Failed' && project.status !== 'Migrated' && (
                            <span className="text-[10px] font-semibold text-primary-purple mt-1">
                              Remaining: {project.formatted_remaining_time || '0s'} left
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-xs font-semibold text-muted-text">
                        {formatDate(project.created_at)}
                      </td>
                      <td className="px-6 py-4.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => router.push(`/projects/${project.id}`)}
                            title="View Progress Details"
                            className="p-2 hover:bg-primary-purple/10 hover:text-primary-purple rounded-lg text-muted-text transition-colors duration-150 cursor-pointer"
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </button>
                          
                          <button
                            onClick={() => handleDownloadReport(project)}
                            title="Download Migration Report"
                            disabled={project.status !== 'Completed' && project.status !== 'Failed' && project.status !== 'Migrated'}
                            className="p-2 hover:bg-primary-purple/10 hover:text-primary-purple disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-text rounded-lg text-muted-text transition-colors duration-150 cursor-pointer"
                          >
                            <Download className="h-4.5 w-4.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(project.id, project.project_name)}
                            disabled={isDeleting === project.id}
                            title="Delete Migration Record"
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 rounded-lg text-muted-text transition-colors duration-150 cursor-pointer"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
