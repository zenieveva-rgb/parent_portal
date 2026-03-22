import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    query, 
    orderByChild, 
    equalTo, 
    get 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Config - Same as your main app
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
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const folderGrid = document.getElementById('folderGrid');
const totalRecords = document.getElementById('totalRecords');
const searchInput = document.getElementById('searchInput');
const searchMorph = document.getElementById('searchMorph');
const searchTrigger = document.getElementById('searchTrigger');
const alphabetTrack = document.getElementById('alphabetTrack');
const studentModal = document.getElementById('studentModal');
const closeModal = document.getElementById('closeModal');
const closeModalBtn = document.getElementById('closeModalBtn');

let attendanceData = [];
let currentUser = null;

// Generate alphabet index
function generateAlphabet() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    alphabetTrack.innerHTML = alphabet.map(letter => 
        `<a href="#section-${letter}" class="alpha-pill" data-letter="${letter}">${letter}</a>`
    ).join('');
}

// Create particles
function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

// Group data by student
function processAttendanceData(data) {
    const grouped = {};
    
    Object.entries(data || {}).forEach(([key, record]) => {
        const name = record.studentName || record.name || 'Unknown';
        const grade = record.grade || 'N/A';
        
        if (!grouped[name]) {
            grouped[name] = {
                name: name,
                grade: grade,
                scans: [],
                lastScan: null
            };
        }
        
        const scanTime = new Date(record.timestamp || record.time || record.scannedAt);
        grouped[name].scans.push({
            id: key,
            time: scanTime,
            type: record.type || 'qr',
            rawData: record
        });
        
        if (!grouped[name].lastScan || scanTime > grouped[name].lastScan) {
            grouped[name].lastScan = scanTime;
        }
    });
    
    // Sort scans within each student (newest first)
    Object.values(grouped).forEach(student => {
        student.scans.sort((a, b) => b.time - a.time);
    });
    
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
}

// Get first letter for alphabet grouping
function getFirstLetter(name) {
    return name.charAt(0).toUpperCase();
}

// Render folder grid
function renderFolders(students) {
    if (students.length === 0) {
        folderGrid.innerHTML = `
            <div class="empty-state-archive">
                <i class="fa-solid fa-box-open"></i>
                <h3>No Records Found</h3>
                <p>Attendance history will appear here once students are scanned</p>
            </div>
        `;
        totalRecords.textContent = '0 total records';
        return;
    }

    totalRecords.textContent = `${students.length} student${students.length !== 1 ? 's' : ''} • ${students.reduce((acc, s) => acc + s.scans.length, 0)} scans`;

    let currentLetter = '';
    let html = '';

    students.forEach((student, index) => {
        const firstLetter = getFirstLetter(student.name);
        const scanCount = student.scans.length;
        
        // Add letter divider if new letter
        if (firstLetter !== currentLetter) {
            currentLetter = firstLetter;
            html += `<div class="letter-divider" id="section-${firstLetter}">${firstLetter}</div>`;
        }

        const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        html += `
            <div class="folder-card" data-name="${student.name.toLowerCase()}" style="animation-delay: ${index * 0.05}s">
                <div class="folder-icon-section">
                    <div class="folder-icon-wrap">
                        <i class="fa-solid fa-folder"></i>
                        <span class="folder-count-badge">${scanCount}</span>
                    </div>
                    <div class="folder-info-compact">
                        <span class="folder-name-text">${student.name}</span>
                        <span class="folder-meta">
                            <i class="fa-solid fa-graduation-cap"></i> ${student.grade}
                        </span>
                    </div>
                </div>
                <div class="folder-stats">
                    <span class="grade-pill">${student.grade}</span>
                    <span class="scans-text">${scanCount} scan${scanCount !== 1 ? 's' : ''}</span>
                </div>
                <button class="folder-view-btn" onclick="openStudentModal('${student.name}')">
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        `;
    });

    folderGrid.innerHTML = html;
}

// Open student modal
window.openStudentModal = function(studentName) {
    const student = attendanceData.find(s => s.name === studentName);
    if (!student) return;

    document.getElementById('modalStudentName').textContent = student.name;
    document.getElementById('modalStudentGrade').textContent = student.grade;
    document.getElementById('totalScans').textContent = student.scans.length;
    document.getElementById('lastScan').textContent = student.lastScan ? 
        student.lastScan.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--';
    
    // Set avatar initials
    const initials = student.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('modalAvatar').textContent = initials;

    // Render logs
    const logsList = document.getElementById('logsList');
    logsList.innerHTML = student.scans.map((scan, idx) => `
        <div class="log-entry" style="animation-delay: ${idx * 0.05}s">
            <div class="log-time">
                <i class="fa-regular fa-clock"></i>
                ${scan.time.toLocaleDateString()} at ${scan.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                ${scan.type === 'manual' ? '<span class="manual-badge"><i class="fa-solid fa-keyboard"></i> Manual</span>' : ''}
            </div>
            <button class="delete-log-btn" onclick="deleteLog('${student.name}', '${scan.id}')" title="Delete Entry">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');

    studentModal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

// Close modal
function closeStudentModal() {
    studentModal.classList.remove('active');
    document.body.style.overflow = '';
}

// Search functionality
function filterStudents(query) {
    const normalized = query.toLowerCase();
    const filtered = attendanceData.filter(s => s.name.toLowerCase().includes(normalized));
    renderFolders(filtered);
}

// Load attendance data
function loadAttendanceData(userId) {
    const attendanceRef = ref(database, 'attendance');
    
    onValue(attendanceRef, (snapshot) => {
        const data = snapshot.val() || {};
        // Filter by user if needed, or show all
        attendanceData = processAttendanceData(data);
        renderFolders(attendanceData);
    });
}

// Auth state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadAttendanceData(user.uid);
        
        // Check if user is approved
        get(ref(database, `users/${user.uid}`)).then((snapshot) => {
            if (!snapshot.exists() || snapshot.val().status !== 'approved') {
                window.location.href = 'index.html';
            }
        });
    } else {
        window.location.href = 'index.html';
    }
});

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    generateAlphabet();

    // Search morph toggle
    searchTrigger.addEventListener('click', () => {
        searchMorph.classList.toggle('active');
        if (searchMorph.classList.contains('active')) {
            searchInput.focus();
        }
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
        filterStudents(e.target.value);
    });

    // Navigation
    document.getElementById('navToPortal').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Modal close
    closeModal.addEventListener('click', closeStudentModal);
    closeModalBtn.addEventListener('click', closeStudentModal);
    studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) closeStudentModal();
    });

    // Alphabet scroll
    alphabetTrack.addEventListener('click', (e) => {
        if (e.target.classList.contains('alpha-pill')) {
            e.preventDefault();
            const letter = e.target.dataset.letter;
            const section = document.getElementById(`section-${letter}`);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Highlight active
                document.querySelectorAll('.alpha-pill').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
            }
        }
    });
});

// Delete log placeholder (integrate with your trash system)
window.deleteLog = function(studentName, logId) {
    // Integrate with your existing trash functionality
    console.log('Delete:', studentName, logId);
};
