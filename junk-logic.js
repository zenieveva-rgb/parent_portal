import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    off, 
    remove, 
    update, 
    get,
    push 
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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

let trashUnsubscribe = null;
let trashDataCache = {};

function setupSingleTrashListener() {
    if (trashUnsubscribe) return;

    const trashRef = ref(db, 'trash');
    
    trashUnsubscribe = onValue(trashRef, (snapshot) => {
        trashDataCache = snapshot.val() || {};
        renderTrash(trashDataCache);
    }, (error) => {
        console.error("Trash listener error:", error);
    });
}

function renderTrash(data) {
    const table = document.getElementById('junkTable');
    const countEl = document.getElementById('trashCount');
    
    if (!table) return;

    const entries = Object.entries(data);
    
    if (countEl) {
        countEl.textContent = `${entries.length} item${entries.length !== 1 ? 's' : ''}`;
    }

    if (entries.length === 0) {
        table.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-trash-can fa-3x"></i>
                <p>Trash is empty</p>
                <span class="sub-text">Deleted items will appear here for 30 days</span>
            </div>
        `;
        return;
    }

    const grouped = {};
    entries.forEach(([key, item]) => {
        const name = item.studentName || 'Unknown';
        if (!grouped[name]) grouped[name] = [];
        grouped[name].push({ key, ...item });
    });

    table.innerHTML = Object.entries(grouped).map(([name, items]) => `
        <div class="trash-group">
            <div class="trash-group-header">
                <span class="trash-name"><i class="fa-solid fa-user"></i> ${name}</span>
                <span class="trash-badge">${items.length} scan${items.length !== 1 ? 's' : ''}</span>
            </div>
            ${items.map(item => `
                <div class="trash-item">
                    <div class="trash-info">
                        <span class="trash-date">
                            <i class="fa-regular fa-calendar"></i> 
                            ${formatDate(item.deletedAt)}
                        </span>
                        <span class="trash-time">${formatTime(item.time || item.scannedAt)}</span>
                    </div>
                    <div class="trash-actions">
                        <button class="restore-btn" onclick="window.secureRestore('${item.key}')" title="Restore">
                            <i class="fa-solid fa-rotate-left"></i> Restore
                        </button>
                        <button class="perm-delete-btn" onclick="window.securePermDelete('${item.key}')" title="Delete Forever">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

// Use secure functions from parent window
window.restoreItem = async (trashKey) => {
    const item = trashDataCache[trashKey];
    if (!item) return;

    try {
        const updates = {};
        const originalKey = item.originalKey || push(ref(db, 'attendance')).key;
        
        updates[`attendance/${originalKey}`] = {
            studentName: item.studentName,
            grade: item.grade,
            time: item.time || item.scannedAt,
            scannedAt: item.scannedAt || item.time,
            restoredAt: new Date().toISOString()
        };
        
        updates[`trash/${trashKey}`] = null;
        
        await update(ref(db), updates);
        showToast(`Restored ${item.studentName}`, 'success');
    } catch (error) {
        console.error("Restore error:", error);
        showToast("Failed to restore", "error");
    }
};

document.getElementById('emptyTrashBtn')?.addEventListener('click', window.secureEmptyTrash);
document.getElementById('navToPortal')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});

function formatDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '--:--';
    const d = new Date(timeStr);
    if (isNaN(d)) return timeStr;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.addEventListener('beforeunload', () => {
    if (trashUnsubscribe) trashUnsubscribe();
});

document.addEventListener('DOMContentLoaded', setupSingleTrashListener);