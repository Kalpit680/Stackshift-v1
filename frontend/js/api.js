const API_BASE = './backend/api';

const ApiService = {
    /**
     * Upload the project ZIP file to the server.
     */
    async uploadProject(projectName, file, onProgress) {
        const formData = new FormData();
        formData.append('projectName', projectName);
        formData.append('file', file);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE}/upload.php`, true);

            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        onProgress(percentComplete);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject(new Error("Failed to parse server response: " + xhr.responseText));
                    }
                } else {
                    reject(new Error(`Upload failed with status: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during file upload."));
            xhr.send(formData);
        });
    },

    /**
     * Trigger project code analysis.
     */
    async scanProject(projectId) {
        const response = await fetch(`${API_BASE}/scan.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ projectId })
        });
        
        const data = await response.json();
        if (!response.ok || data.status === 'error') {
            throw new Error(data.message || 'Scanning failed.');
        }
        return data;
    },

    /**
     * Trigger version compatibility migrations.
     */
    async migrateProject(projectId, targetVersion) {
        const response = await fetch(`${API_BASE}/migrate.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ projectId, targetVersion })
        });

        const data = await response.json();
        if (!response.ok || data.status === 'error') {
            throw new Error(data.message || 'Migration failed.');
        }
        return data;
    },

    /**
     * Get the download path for the migrated zip.
     */
    getDownloadUrl(projectId) {
        return `${API_BASE}/download.php?projectId=${projectId}`;
    }
};
