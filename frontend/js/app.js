document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const views = {
        upload: document.getElementById('view-upload'),
        scanProgress: document.getElementById('view-scan-progress'),
        scanSummary: document.getElementById('view-scan-summary'),
        migrateProgress: document.getElementById('view-migrate-progress'),
        report: document.getElementById('view-report')
    };

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const projectNameInput = document.getElementById('project-name');
    const uploadBtn = document.getElementById('btn-upload');
    const selectedFileText = document.getElementById('selected-file-text');

    let currentFile = null;
    let projectId = null;
    let scanResults = null;
    let migrationReport = null;

    // Helper: Show View
    function showView(viewId) {
        Object.keys(views).forEach(key => {
            views[key].style.display = 'none';
        });
        views[viewId].style.display = 'block';
    }

    // Drag and Drop Events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (file.name.endsWith('.zip')) {
            currentFile = file;
            selectedFileText.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            uploadBtn.classList.remove('btn-disabled');
            
            // Auto fill project name if empty
            if (!projectNameInput.value.trim()) {
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                projectNameInput.value = nameWithoutExt;
            }
        } else {
            alert('Please select a valid ZIP archive file.');
        }
    }

    // Trigger Upload & Scan Flow
    uploadBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        const projectName = projectNameInput.value.trim() || 'Codelift Project';
        
        try {
            showView('scanProgress');
            const progressFill = document.querySelector('#view-scan-progress .progress-bar-fill');
            const statusText = document.querySelector('#view-scan-progress .loader-text');
            
            statusText.textContent = 'Uploading ZIP archive...';
            progressFill.style.width = '20%';

            // 1. Upload ZIP
            const uploadResponse = await ApiService.uploadProject(projectName, currentFile, (percent) => {
                progressFill.style.width = `${Math.min(20 + percent * 0.4, 60)}%`;
            });
            
            projectId = uploadResponse.projectId;
            statusText.textContent = 'Extracting ZIP & Analyzing structure...';
            progressFill.style.width = '70%';

            // 2. Perform Code Scan
            const scanResponse = await ApiService.scanProject(projectId);
            scanResults = scanResponse;
            
            progressFill.style.width = '100%';
            
            setTimeout(() => {
                renderScanSummary();
                showView('scanSummary');
            }, 500);

        } catch (error) {
            alert(`Error: ${error.message}`);
            showView('upload');
        }
    });

    // Render Scan Dashboard Page
    function renderScanSummary() {
        document.getElementById('sum-project-name').textContent = scanResults.projectName;
        document.getElementById('stat-lang').textContent = scanResults.detectedLanguage;
        document.getElementById('stat-version').textContent = scanResults.detectedVersion;
        document.getElementById('stat-framework').textContent = scanResults.detectedFramework;
        document.getElementById('stat-total-files').textContent = scanResults.totalFiles;
        document.getElementById('stat-php-files').textContent = scanResults.phpFiles;
        document.getElementById('stat-warnings').textContent = scanResults.warningsCount;

        // Set default target version option selector
        const select = document.getElementById('target-version-select');
        select.innerHTML = '';
        
        if (parseFloat(scanResults.detectedVersion) < 7.0) {
            select.innerHTML += '<option value="7.4" selected>PHP 7.4 (Recommended)</option>';
            select.innerHTML += '<option value="8.0">PHP 8.0</option>';
            select.innerHTML += '<option value="8.2">PHP 8.2</option>';
        } else {
            select.innerHTML += '<option value="8.2" selected>PHP 8.2 (Recommended)</option>';
            select.innerHTML += '<option value="8.0">PHP 8.0</option>';
        }
    }

    // Trigger Migration Flow
    document.getElementById('btn-start-migration').addEventListener('click', async () => {
        const targetVersion = document.getElementById('target-version-select').value;
        
        try {
            showView('migrateProgress');
            const progressFill = document.querySelector('#view-migrate-progress .progress-bar-fill');
            const statusText = document.querySelector('#view-migrate-progress .loader-text');
            
            statusText.textContent = 'Loading rules & setting parser...';
            progressFill.style.width = '25%';

            setTimeout(async () => {
                statusText.textContent = 'Matching rules and executing refactor code...';
                progressFill.style.width = '65%';
                
                try {
                    const response = await ApiService.migrateProject(projectId, targetVersion);
                    migrationReport = response;

                    progressFill.style.width = '100%';
                    setTimeout(() => {
                        renderMigrationReport();
                        showView('report');
                    }, 500);

                } catch (err) {
                    alert(`Migration Error: ${err.message}`);
                    showView('scanSummary');
                }
            }, 600);

        } catch (error) {
            alert(`Migration Error: ${error.message}`);
            showView('scanSummary');
        }
    });

    // Render Side-by-Side Code Diffs and Download Details
    function renderMigrationReport() {
        document.getElementById('rep-rules-applied').textContent = migrationReport.rulesApplied;
        document.getElementById('rep-confidence').textContent = `${migrationReport.confidenceScore}%`;
        document.getElementById('rep-files-changed').textContent = migrationReport.migratedFiles.length;
        
        const downloadBtn = document.getElementById('btn-download-zip');
        downloadBtn.href = ApiService.getDownloadUrl(projectId);

        const diffContainer = document.getElementById('diff-files-list');
        diffContainer.innerHTML = '';

        if (migrationReport.migratedFiles.length === 0) {
            diffContainer.innerHTML = '<p class="subtitle text-center" style="margin-top:2rem;">No modifications were necessary. Your code is fully compatible!</p>';
            return;
        }

        migrationReport.migratedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'finding-item';

            // Generate HTML code lines of diffs
            const diffLinesHtml = file.diff.split('\n').map(line => {
                if (line.startsWith('- ')) {
                    return `<div class="diff-line diff-line-removed">${escapeHtml(line)}</div>`;
                } else if (line.startsWith('+ ')) {
                    return `<div class="diff-line diff-line-added">${escapeHtml(line)}</div>`;
                } else if (line.startsWith('@@ ')) {
                    return `<div class="diff-line diff-line-meta">${escapeHtml(line)}</div>`;
                } else if (line.trim() !== '') {
                    return `<div class="diff-line">${escapeHtml(line)}</div>`;
                }
                return '';
            }).join('');

            fileItem.innerHTML = `
                <div class="finding-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span class="finding-title">${escapeHtml(file.filePath)}</span>
                    <span class="badge badge-success">${file.appliedRules.length} fixes applied</span>
                </div>
                <div class="finding-body" style="display: ${index === 0 ? 'block' : 'none'};">
                    <p class="card-stat-label">Refactoring Rules Applied: <code>${file.appliedRules.join(', ')}</code></p>
                    <div class="code-diff-container">
                        ${diffLinesHtml}
                    </div>
                </div>
            `;
            diffContainer.appendChild(fileItem);
        });
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Go Back Buttons
    document.getElementById('btn-back-to-upload').addEventListener('click', () => {
        showView('upload');
    });
    
    document.getElementById('btn-back-to-summary').addEventListener('click', () => {
        showView('scanSummary');
    });

    document.getElementById('btn-start-over').addEventListener('click', () => {
        currentFile = null;
        fileInput.value = '';
        projectNameInput.value = '';
        selectedFileText.textContent = 'Drag and drop your project ZIP file here, or click to browse files';
        uploadBtn.classList.add('btn-disabled');
        showView('upload');
    });
});
