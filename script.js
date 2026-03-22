import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    off, 
    remove, 
    update, 
    get,
    push,
    set
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";
import {
    getAuth,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updatePassword,
    onAuthStateChanged,
    verifyPasswordResetCode,
    confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";

// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyBdlEvDlQ1qWr8xdL4bV25NW4RgcTajYqM",
    authDomain: "database-98a70.firebaseapp.com",
    databaseURL: "https://database-98a70-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "database-98a70",
    storageBucket: "database-98a70.firebasestorage.app",
    messagingSenderId: "460345885965",
    appId: "1:460345885965:web:8484da766b979a0eaf9c44"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ==================== SECURITY CONFIG ====================
const SECURITY = {
    ADMIN_EMAIL: "depeddcp11@gmail.com",  // Your recovery email
    DELETE_PASSWORD: "Admin123!",         // Default password
    PASSWORD_HASH_PATH: "systemConfig/deletePassword",  // Where password hash is stored
    SESSION_TIMEOUT: 30 * 60 * 1000,     // 30 minutes in milliseconds
    MAX_ATTEMPTS: 5,                      // Max failed attempts before lockout
    LOCKOUT_TIME: 5 * 60 * 1000          // 5 minutes lockout in milliseconds
};

// ==================== GLOBAL STATE ====================
const state = {
    attendanceData: {},
    currentSearch: "",
    unsubscribeAttendance: null,
    isAuthenticated: false,
    authExpiry: null,
    failedAttempts: 0,
    lockoutUntil: null,
    pendingDelete: null,
    bcryptLoaded: false
};

// ==================== LOAD BCRYPT (FIXED CDN) ====================
async function loadBcrypt() {
    if (state.bcryptLoaded) return true;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        // Use jsDelivr CDN which is more reliable [^53^]
        script.src = "https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js";
        script.onload = () => {
            state.bcryptLoaded = true;
            console.log("bcrypt loaded successfully");
            resolve(true);
        };
        script.onerror = () => {
            console.error("Failed to load bcrypt");
            reject(false);
        };
        document.head.appendChild(script);
    });
}

// ==================== INITIALIZE SECURITY ====================
async function initializeSecurity() {
    try {
        await loadBcrypt();
        
        // Check if password hash exists, if not create default
        const hashRef = ref(db, SECURITY.PASSWORD_HASH_PATH);
        const snapshot = await get(hashRef);
        
        if (!snapshot.exists()) {
            // Create default password "Admin123!" hashed
            const defaultHash = await hashPassword("Admin123!");
            await set(hashRef, {
                hash: defaultHash,
                createdAt: new Date().toISOString(),
                mustChange: true
            });
            console.log("Default password created: Admin123!");
            showToast("Default password: Admin123! - Please change immediately!", "warning", 10000);
        }
        
        setupAuthListener();
    } catch (error) {
        console.error("Security initialization error:", error);
        showToast("Security system failed to initialize", "error");
    }
}

// ==================== PASSWORD HASHING ====================
async function hashPassword(password) {
    if (!window.dcodeIO?.bcrypt) await loadBcrypt();
    const bcrypt = window.dcodeIO.bcrypt;
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
    if (!window.dcodeIO?.bcrypt) await loadBcrypt();
    const bcrypt = window.dcodeIO.bcrypt;
    return await bcrypt.compare(password, hash);
}

// ==================== AUTHENTICATION LISTENER ====================
function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        if (user && user.email === SECURITY.ADMIN_EMAIL) {
            state.isAuthenticated = true;
            state.authExpiry = Date.now() + SECURITY.SESSION_TIMEOUT;
            console.log("Admin authenticated via Firebase Auth");
        } else {
            state.isAuthenticated = false;
        }
    });
}

// ==================== SECURITY MODAL FUNCTIONS ====================
function showPasswordModal(deleteAction) {
    // Check lockout
    if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
        const remaining = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
        showToast(`Too many attempts. Try again in ${remaining}s`, "error");
        return;
    }

    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('securityPassword');
    const error = document.getElementById('passwordError');
    const confirmBtn = document.getElementById('confirmPassword');
    const cancelBtn = document.getElementById('cancelPassword');
    const forgotLink = document.getElementById('forgotPassword');
    const toggleBtn = document.getElementById('togglePassword');
    
    state.pendingDelete = deleteAction;
    error.textContent = '';
    input.value = '';
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    input.focus();
    
    // Toggle password visibility
    toggleBtn.onclick = () => {
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        toggleBtn.innerHTML = `<i class="fa-solid fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
    };
    
    // Confirm button
    confirmBtn.onclick = async () => {
        const password = input.value;
        if (!password) {
            error.textContent = 'Please enter password';
            return;
        }
        
        await verifyAndProceed(password);
    };
    
    // Cancel button
    cancelBtn.onclick = closePasswordModal;
    
    // Forgot password
    forgotLink.onclick = (e) => {
        e.preventDefault();
        closePasswordModal();
        showResetModal();
    };
    
    // Enter key
    input.onkeypress = (e) => {
        if (e.key === 'Enter') confirmBtn.click();
    };
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        state.pendingDelete = null;
    }, 300);
}

function showResetModal() {
    const modal = document.getElementById('resetModal');
    const sendBtn = document.getElementById('sendReset');
    const cancelBtn = document.getElementById('cancelReset');
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    sendBtn.onclick = async () => {
        showLoading(true);
        try {
            // FIXED: Proper Firebase Auth password reset with actionCodeSettings [^46^]
            const actionCodeSettings = {
                url: window.location.href, // Redirect back to current page after reset
                handleCodeInApp: false
            };
            
            await sendPasswordResetEmail(auth, SECURITY.ADMIN_EMAIL, actionCodeSettings);
            showToast("Reset link sent to depeddcp11@gmail.com!", "success");
            closeResetModal();
        } catch (error) {
            console.error("Reset error:", error);
            let errorMsg = "Failed to send reset email";
            if (error.code === 'auth/user-not-found') {
                errorMsg = "Admin account not found. Creating account...";
                // Create the user first
                try {
                    await createUserWithEmailAndPassword(auth, SECURITY.ADMIN_EMAIL, "TempPass123!");
                    await sendPasswordResetEmail(auth, SECURITY.ADMIN_EMAIL, actionCodeSettings);
                    errorMsg = "Account created! Reset link sent to email.";
                } catch (createError) {
                    errorMsg = "Failed to create admin account";
                }
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = "Invalid email configuration";
            }
            showToast(errorMsg, "error");
        }
        showLoading(false);
    };
    
    cancelBtn.onclick = closeResetModal;
}

function closeResetModal() {
    const modal = document.getElementById('resetModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

function showLoading(show) {
    const loading = document.getElementById('securityLoading');
    loading.style.display = show ? 'flex' : 'none';
}

// ==================== VERIFY PASSWORD ====================
async function verifyAndProceed(password) {
    showLoading(true);
    
    try {
        // Get stored hash
        const hashRef = ref(db, SECURITY.PASSWORD_HASH_PATH);
        const snapshot = await get(hashRef);
        const storedData = snapshot.val();
        
        if (!storedData) {
            throw new Error("Security configuration not found");
        }
        
        // Verify using bcrypt
        const isValid = await verifyPassword(password, storedData.hash);
        
        if (isValid) {
            // Reset failed attempts
            state.failedAttempts = 0;
            state.lockoutUntil = null;
            
            // Set authentication session
            state.isAuthenticated = true;
            state.authExpiry = Date.now() + SECURITY.SESSION_TIMEOUT;
            
            // Sign in to Firebase Auth for additional security
            try {
                await signInWithEmailAndPassword(auth, SECURITY.ADMIN_EMAIL, password);
            } catch (authError) {
                // If user doesn't exist, create them
                if (authError.code === 'auth/user-not-found') {
                    await createUserWithEmailAndPassword(auth, SECURITY.ADMIN_EMAIL, password);
                } else if (authError.code !== 'auth/wrong-password') {
                    throw authError;
                }
            }
            
            closePasswordModal();
            
            // Execute pending delete
            if (state.pendingDelete) {
                await executeDelete(state.pendingDelete);
            }
            
            showToast("Security verification passed", "success");
        } else {
            handleFailedAttempt();
        }
    } catch (error) {
        console.error("Verification error:", error);
        showToast("Security error occurred", "error");
    }
    
    showLoading(false);
}

function handleFailedAttempt() {
    state.failedAttempts++;
    const remaining = SECURITY.MAX_ATTEMPTS - state.failedAttempts;
    
    const errorEl = document.getElementById('passwordError');
    if (state.failedAttempts >= SECURITY.MAX_ATTEMPTS) {
        state.lockoutUntil = Date.now() + SECURITY.LOCKOUT_TIME;
        errorEl.textContent = `Too many failed attempts. Locked for 5 minutes.`;
        showToast("Security lockout activated", "error");
    } else {
        errorEl.textContent = `Invalid password. ${remaining} attempts remaining.`;
        showToast(`Invalid password. ${remaining} attempts left.`, "error");
    }
}

// ==================== EXECUTE DELETE ====================
async function executeDelete(action) {
    if (!state.isAuthenticated || Date.now() > state.authExpiry) {
        showToast("Session expired. Please verify again.", "error");
        state.isAuthenticated = false;
        return;
    }
    
    try {
        switch(action.type) {
            case 'log':
                await remove(ref(db, `attendance/${action.key}`));
                showToast("Log deleted successfully", "success");
                break;
            case 'trash':
                await remove(ref(db, `trash/${action.key}`));
                showToast("Permanently deleted", "success");
                break;
            case 'restore':
                await restoreItem(action.key);
                break;
            case 'emptyTrash':
                await remove(ref(db, 'trash'));
                showToast("Trash emptied", "success");
                break;
        }
    } catch (error) {
        console.error("Delete error:", error);
        showToast("Operation failed", "error");
    }
}

// ==================== RESTORE ITEM ====================
async function restoreItem(trashKey) {
    try {
        const trashRef = ref(db, `trash/${trashKey}`);
        const snapshot = await get(trashRef);
        const entry = snapshot.val();
        
        if (!entry) {
            showToast("Entry not found in trash", "error");
            return;
        }

        const updates = {};
        
        // Check if it's a single log or student data
        if (entry.logs && Array.isArray(entry.logs)) {
            // Student data with multiple logs
            entry.logs.forEach(log => {
                if (log.originalKey) {
                    const logData = { ...log };
                    delete logData.originalKey;
                    updates[`attendance/${log.originalKey}`] = logData;
                }
            });
        } else {
            // Single log entry
            const logData = { ...entry };
            delete logData.originalKey;
            if (entry.originalKey) {
                updates[`attendance/${entry.originalKey}`] = logData;
            } else {
                // Generate new key if originalKey doesn't exist
                const newKey = push(ref(db, 'attendance')).key;
                updates[`attendance/${newKey}`] = logData;
            }
        }
        
        // Remove from trash
        updates[`trash/${trashKey}`] = null;
        
        await update(ref(db), updates);
        showToast("Successfully restored!", "success");
    } catch (error) {
        console.error("Restore error:", error);
        showToast("Failed to restore item", "error");
    }
}

// ==================== PUBLIC SECURE DELETE API ====================
window.secureDeleteLog = (key) => {
    showPasswordModal({ type: 'log', key });
};

window.securePermDelete = (key) => {
    showPasswordModal({ type: 'trash', key });
};

window.secureRestore = (key) => {
    showPasswordModal({ type: 'restore', key });
};

window.secureEmptyTrash = () => {
    if (confirm("⚠️ WARNING: This will permanently delete ALL items in trash. Continue?")) {
        if (confirm("Are you absolutely sure? This cannot be undone.")) {
            showPasswordModal({ type: 'emptyTrash' });
        }
    }
};

// ==================== CHANGE PASSWORD FUNCTION ====================
window.changeAdminPassword = async (oldPassword, newPassword) => {
    showLoading(true);
    try {
        // Verify old password
        const hashRef = ref(db, SECURITY.PASSWORD_HASH_PATH);
        const snapshot = await get(hashRef);
        const storedData = snapshot.val();
        
        const isValid = await verifyPassword(oldPassword, storedData.hash);
        if (!isValid) {
            showToast("Current password is incorrect", "error");
            showLoading(false);
            return false;
        }
        
        // Hash new password
        const newHash = await hashPassword(newPassword);
        
        // Update in database
        await set(hashRef, {
            hash: newHash,
            updatedAt: new Date().toISOString(),
            mustChange: false
        });
        
        // Update Firebase Auth password
        const user = auth.currentUser;
        if (user) {
            await updatePassword(user, newPassword);
        }
        
        showToast("Password changed successfully!", "success");
        showLoading(false);
        return true;
    } catch (error) {
        console.error("Change password error:", error);
        showToast("Failed to change password", "error");
        showLoading(false);
        return false;
    }
};

// ==================== UTILITY FUNCTIONS ====================
function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function animateIcon(element) {
    if (!element) return;
    element.style.transform = "scale(1.2)";
    element.style.color = "var(--neon-cyan)";
    setTimeout(() => {
        element.style.transform = "scale(1)";
        element.style.color = "";
    }, 300);
}

// ==================== FORMATTERS ====================
function formatTime(timeStr) {
    if (!timeStr) return '--:--';
    const date = new Date(timeStr);
    if (isNaN(date)) return timeStr;
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// ==================== RENDER FUNCTIONS ====================
function renderPortal(data, searchTerm = "") {
    const table = document.getElementById('attendanceTable');
    const counter = document.getElementById('scanCounter');
    if (!table) return;

    const entries = Object.entries(data);
    const filtered = entries.filter(([key, val]) => {
        const name = (val.studentName || "").toLowerCase();
        return name.includes(searchTerm);
    }).sort((a, b) => new Date(b[1].time || b[1].scannedAt) - new Date(a[1].time || a[1].scannedAt));

    if (counter) {
        counter.textContent = `${entries.length} scan${entries.length !== 1 ? 's' : ''} today`;
    }

    if (filtered.length === 0) {
        table.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-satellite-dish"></i>
                <p>${searchTerm ? 'No matches found' : 'Waiting for scans...'}</p>
            </div>
        `;
        return;
    }

    table.innerHTML = filtered.map(([key, val], index) => `
        <div class="attendance-row scan-entry" data-key="${key}" style="animation-delay: ${index * 0.05}s">
            <div class="student-info-cell">
                <div class="avatar-sm">
                    <i class="fa-solid fa-user"></i>
                </div>
                <span class="student-name">${val.studentName || 'Unknown'}</span>
            </div>
            <span class="grade-badge">${val.grade || 'N/A'}</span>
            <span class="time-badge">
                <i class="fa-regular fa-clock"></i>
                ${formatTime(val.time || val.scannedAt)}
            </span>
        </div>
    `).join('');
}

function renderHistory(data, searchTerm = "") {
    const table = document.getElementById('historyTable');
    const counter = document.getElementById('folderCounter');
    const alphabetTrack = document.getElementById('alphabetTrack');
    
    if (!table) return;

    const albums = {};
    Object.entries(data).forEach(([key, val]) => {
        const name = val.studentName || "Unknown Student";
        if (!albums[name]) {
            albums[name] = { 
                grade: val.grade || 'N/A', 
                logs: [],
                lastScan: null
            };
        }
        albums[name].logs.push({ key, ...val });
        
        const scanTime = new Date(val.time || val.scannedAt || 0);
        if (!albums[name].lastScan || scanTime > albums[name].lastScan) {
            albums[name].lastScan = scanTime;
        }
    });

    const sortedNames = Object.keys(albums).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase())
    );

    if (counter) {
        counter.textContent = `${sortedNames.length} folder${sortedNames.length !== 1 ? 's' : ''}`;
    }

    if (alphabetTrack) {
        const letters = [...new Set(sortedNames.map(n => n[0].toUpperCase()))].sort();
        alphabetTrack.innerHTML = letters.map(l => 
            `<a href="#letter-${l}" class="alpha-pill" data-letter="${l}">${l}</a>`
        ).join('');
        
        alphabetTrack.querySelectorAll('.alpha-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.preventDefault();
                const letter = pill.getAttribute('data-letter');
                const target = document.getElementById(`letter-${letter}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    alphabetTrack.querySelectorAll('.alpha-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                }
            });
        });
    }

    const filteredNames = sortedNames.filter(name => 
        name.toLowerCase().includes(searchTerm)
    );

    if (filteredNames.length === 0) {
        table.innerHTML = `
            <div class="empty-state-archive">
                <i class="fa-solid fa-folder-open"></i>
                <h3>${searchTerm ? 'No matches found' : 'No student records'}</h3>
                <p>${searchTerm ? 'Try a different search term' : 'Scanned data will appear here'}</p>
            </div>
        `;
        return;
    }

    let currentLetter = '';
    
    table.innerHTML = filteredNames.map((name, index) => {
        const student = albums[name];
        const firstLetter = name[0].toUpperCase();
        const showDivider = firstLetter !== currentLetter;
        currentLetter = firstLetter;
        
        const lastScanDate = student.lastScan ? 
            student.lastScan.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
            'Never';
        
        return `
            ${showDivider ? `<div id="letter-${firstLetter}" class="letter-divider">${firstLetter}</div>` : ''}
            <div class="folder-card" data-name="${name}" style="animation-delay: ${index * 0.05}s">
                <div class="folder-icon-section">
                    <div class="folder-icon-wrap">
                        <i class="fa-solid fa-folder"></i>
                        <span class="folder-count-badge">${student.logs.length}</span>
                    </div>
                    <div class="folder-info-compact">
                        <div class="folder-name-text">${name}</div>
                        <div class="folder-meta">
                            <i class="fa-solid fa-calendar"></i> Last: ${lastScanDate}
                        </div>
                    </div>
                </div>
                
                <div class="folder-stats">
                    <span class="grade-pill">${student.grade}</span>
                    <span class="scans-text">${student.logs.length} scan${student.logs.length !== 1 ? 's' : ''}</span>
                </div>
                
                <button class="folder-view-btn" onclick="window.openFolder('${name}')" title="View Details">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
    }).join('');
}

// ==================== MODAL FUNCTIONS ====================
window.openFolder = (name) => {
    const data = state.attendanceData;
    const logs = Object.entries(data)
        .filter(([k, v]) => v.studentName === name)
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => new Date(b.time || b.scannedAt) - new Date(a.time || a.scannedAt));

    if (logs.length === 0) return;

    const modal = document.getElementById('historyModal');
    const nameEl = document.getElementById('modalStudentName');
    const gradeEl = document.getElementById('modalStudentGrade');
    const logsEl = document.getElementById('individualLogs');
    const totalEl = document.getElementById('totalScans');
    const lastEl = document.getElementById('lastScan');

    if (!modal) return;

    nameEl.textContent = name;
    gradeEl.textContent = `Grade: ${logs[0].grade || 'N/A'}`;
    totalEl.textContent = logs.length;
    lastEl.textContent = formatTime(logs[0].time || logs[0].scannedAt);

    logsEl.innerHTML = logs.map((log, i) => `
        <div class="log-entry" style="animation-delay: ${i * 0.05}s">
            <div class="log-time">
                <i class="fa-regular fa-clock"></i>
                ${formatDateTime(log.time || log.scannedAt)}
            </div>
            <button class="delete-log-btn" onclick="window.secureDeleteLog('${log.key}')" title="Move to Trash">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
};

// ==================== NAVIGATION ====================
function initNavigation() {
    const routes = {
        'navToPortal': 'index.html',
        'navToHistory': 'history.html',
        'trashBinBtn': 'junk.html'
    };

    Object.entries(routes).forEach(([id, url]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                animateIcon(e.currentTarget);
                setTimeout(() => window.location.href = url, 200);
            });
        }
    });
}

// ==================== SEARCH ====================
function initSearch() {
    const searchTrigger = document.querySelector('.search-trigger');
    const searchBox = document.getElementById('searchBox');
    const nameInput = document.getElementById('nameInput');

    if (searchTrigger && searchBox) {
        searchTrigger.addEventListener('click', (e) => {
            animateIcon(e.currentTarget);
            searchBox.classList.toggle('active');
            if (searchBox.classList.contains('active') && nameInput) {
                nameInput.focus();
            }
        });
    }

    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            state.currentSearch = e.target.value.toLowerCase();
            renderPortal(state.attendanceData, state.currentSearch);
        });
    }

    const searchMorph = document.getElementById('searchMorph');
    const searchMorphBtn = document.getElementById('searchMorphBtn');
    const archiveSearch = document.getElementById('archiveSearch');

    if (searchMorphBtn && searchMorph) {
        searchMorphBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = searchMorph.classList.toggle('active');
            
            if (isActive) {
                archiveSearch?.focus();
            } else {
                archiveSearch.value = '';
                state.currentSearch = '';
                renderHistory(state.attendanceData, '');
            }
        });

        document.addEventListener('click', (e) => {
            if (searchMorph?.classList.contains('active') && 
                !searchMorph.contains(e.target) && 
                !archiveSearch?.value) {
                searchMorph.classList.remove('active');
            }
        });
    }

    if (archiveSearch) {
        archiveSearch.addEventListener('input', (e) => {
            state.currentSearch = e.target.value.toLowerCase();
            renderHistory(state.attendanceData, state.currentSearch);
        });

        archiveSearch.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// ==================== DATA LISTENER ====================
function setupDataListener() {
    if (state.unsubscribeAttendance) return;

    const attendanceRef = ref(db, 'attendance');
    
    state.unsubscribeAttendance = onValue(attendanceRef, (snapshot) => {
        state.attendanceData = snapshot.val() || {};
        
        if (document.getElementById('attendanceTable')) {
            renderPortal(state.attendanceData, state.currentSearch);
        }
        if (document.getElementById('historyTable')) {
            renderHistory(state.attendanceData, state.currentSearch);
        }
    }, (error) => {
        console.error("Database error:", error);
        showToast("Connection error - check internet", "error");
    });
}

// ==================== MODAL HANDLERS ====================
function initModalHandlers() {
    const modal = document.getElementById('historyModal');
    const closeBtns = [
        document.getElementById('closeModal'),
        document.getElementById('closeModalBottom')
    ];

    closeBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modal?.classList.remove('active');
                setTimeout(() => {
                    if (modal) modal.style.display = 'none';
                }, 300);
            });
        }
    });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        });
    }
}
// Manual Attendance Functionality
const manualAttendanceBtn = document.getElementById('manualAttendanceBtn');
const manualAttendanceModal = document.getElementById('manualAttendanceModal');
const cancelManual = document.getElementById('cancelManual');
const confirmManual = document.getElementById('confirmManual');
const manualStudentName = document.getElementById('manualStudentName');
const manualGradeSection = document.getElementById('manualGradeSection');
const manualError = document.getElementById('manualError');

// Open manual attendance modal
manualAttendanceBtn.addEventListener('click', () => {
    manualAttendanceModal.style.display = 'flex';
    manualStudentName.value = '';
    manualGradeSection.value = '';
    manualError.textContent = '';
    manualStudentName.focus();
});

// Close modal on cancel
cancelManual.addEventListener('click', () => {
    manualAttendanceModal.style.display = 'none';
});

// Close modal when clicking outside
manualAttendanceModal.addEventListener('click', (e) => {
    if (e.target === manualAttendanceModal) {
        manualAttendanceModal.style.display = 'none';
    }
});

// Confirm manual attendance
confirmManual.addEventListener('click', async () => {
    const name = manualStudentName.value.trim();
    const gradeSection = manualGradeSection.value.trim();

    // Validation
    if (!name) {
        manualError.textContent = 'Please enter student name';
        return;
    }
    if (!gradeSection) {
        manualError.textContent = 'Please enter grade/section';
        return;
    }

    // Create attendance data object
    const attendanceData = {
        name: name,
        gradeSection: gradeSection,
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        type: 'manual' // Optional: to distinguish manual entries from scans
    };

    try {
        // Add to Firebase (adjust the database path as per your structure)
        // Example using Firebase Realtime Database:
        const newEntryRef = push(ref(database, 'attendance'));
        await set(newEntryRef, attendanceData);
        
        // Or if you're using Firestore:
        // await addDoc(collection(db, 'attendance'), attendanceData);
        
        console.log('Manual attendance added:', attendanceData);
        
        // Close modal
        manualAttendanceModal.style.display = 'none';
        
        // Optional: Show success notification
        showNotification('Attendance added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding manual attendance:', error);
        manualError.textContent = 'Error saving attendance. Please try again.';
    }
});

// Allow Enter key to submit
manualGradeSection.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        confirmManual.click();
    }
});
manualStudentName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        manualGradeSection.focus();
    }
});

// Optional: Notification function
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles (you can also add these to your CSS file)
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
// ==================== PARTICLES ====================
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        container.appendChild(particle);
    }
}

// ==================== CLEANUP ====================
window.addEventListener('beforeunload', () => {
    if (state.unsubscribeAttendance) {
        off(ref(db, 'attendance'), 'value', state.unsubscribeAttendance);
    }
});
function initManualAttendance() {
    const manualAttendanceBtn = document.getElementById('manualAttendanceBtn');
    const manualAttendanceModal = document.getElementById('manualAttendanceModal');
    const cancelManual = document.getElementById('cancelManual');
    const confirmManual = document.getElementById('confirmManual');
    const manualStudentName = document.getElementById('manualStudentName');
    const manualGradeSection = document.getElementById('manualGradeSection');
    const manualError = document.getElementById('manualError');

    if (!manualAttendanceBtn) return; // Exit if button doesn't exist on this page

    // Open manual attendance modal
    manualAttendanceBtn.addEventListener('click', () => {
        manualAttendanceModal.style.display = 'flex';
        setTimeout(() => manualAttendanceModal.classList.add('active'), 10);
        manualStudentName.value = '';
        manualGradeSection.value = '';
        manualError.textContent = '';
        manualStudentName.focus();
    });

    // Close modal functions
    function closeManualModal() {
        manualAttendanceModal.classList.remove('active');
        setTimeout(() => {
            manualAttendanceModal.style.display = 'none';
        }, 300);
    }

    // Close modal on cancel
    cancelManual.addEventListener('click', closeManualModal);

    // Close modal when clicking outside
    manualAttendanceModal.addEventListener('click', (e) => {
        if (e.target === manualAttendanceModal) {
            closeManualModal();
        }
    });

    // Confirm manual attendance
    confirmManual.addEventListener('click', async () => {
        const name = manualStudentName.value.trim();
        const gradeSection = manualGradeSection.value.trim();

        // Validation
        if (!name) {
            manualError.textContent = 'Please enter student name';
            return;
        }
        if (!gradeSection) {
            manualError.textContent = 'Please enter grade/section';
            return;
        }

        // Show loading state
        confirmManual.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
        confirmManual.disabled = true;

        try {
            // Create attendance data object matching your existing structure
            const now = new Date();
            const attendanceData = {
                studentName: name,
                grade: gradeSection,
                time: now.toISOString(),
                scannedAt: now.toISOString(),
                type: 'manual',
                addedBy: 'admin',
                timestamp: now.getTime()
            };

            // Add to Firebase using the existing db reference
            const newEntryRef = push(ref(db, 'attendance'));
            await set(newEntryRef, attendanceData);
            
            console.log('Manual attendance added:', attendanceData);
            
            // Close modal
            closeManualModal();
            
            // Show success toast using your existing toast system
            showToast('Manual attendance added successfully!', 'success');
            
            // Reset button state
            confirmManual.innerHTML = 'Add Attendance';
            confirmManual.disabled = false;
            
        } catch (error) {
            console.error('Error adding manual attendance:', error);
            manualError.textContent = 'Error saving attendance. Please try again.';
            confirmManual.innerHTML = 'Add Attendance';
            confirmManual.disabled = false;
        }
    });

    // Allow Enter key to navigate between fields and submit
    manualStudentName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            manualGradeSection.focus();
        }
    });

    manualGradeSection.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmManual.click();
        }
    });
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Parent Portal with Security...");
    initNavigation();
    initSearch();
    initModalHandlers();
    initParticles();
    initManualAttendance(); // <-- ADD THIS LINE
    setupDataListener();
    initializeSecurity();
});


// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing Parent Portal with Security...");
    initNavigation();
    initSearch();
    initModalHandlers();
    initParticles();
    setupDataListener();
    initializeSecurity(); // Initialize security system
});
