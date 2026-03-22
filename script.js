import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, query, orderByChild, equalTo, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    // Your Firebase config here
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');
const qrScanner = document.getElementById('qrScanner');
const scanResult = document.getElementById('scanResult');
const attendanceHistory = document.getElementById('attendanceHistory');
const historyList = document.getElementById('historyList');

// Manual Attendance Elements - with null checks
let manualAttendanceBtn = null;
let manualAttendanceModal = null;
let closeManualModal = null;
let manualAttendanceForm = null;
let cancelManualBtn = null;

// Initialize Manual Attendance only if elements exist
function initManualAttendance() {
    manualAttendanceBtn = document.getElementById('manualAttendanceBtn');
    manualAttendanceModal = document.getElementById('manualAttendanceModal');
    closeManualModal = document.getElementById('closeManualModal');
    manualAttendanceForm = document.getElementById('manualAttendanceForm');
    cancelManualBtn = document.getElementById('cancelManualBtn');
    
    // Exit if elements don't exist on this page
    if (!manualAttendanceBtn || !manualAttendanceModal) {
        console.log('Manual attendance elements not found on this page');
        return;
    }
    
    // Open modal
    manualAttendanceBtn.addEventListener('click', () => {
        manualAttendanceModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus on first input
        setTimeout(() => {
            const firstInput = document.getElementById('manualStudentId');
            if (firstInput) firstInput.focus();
        }, 100);
    });
    
    // Close modal functions
    const closeModal = () => {
        manualAttendanceModal.classList.remove('active');
        document.body.style.overflow = '';
        if (manualAttendanceForm) manualAttendanceForm.reset();
    };
    
    if (closeManualModal) {
        closeManualModal.addEventListener('click', closeModal);
    }
    
    if (cancelManualBtn) {
        cancelManualBtn.addEventListener('click', closeModal);
    }
    
    // Close on backdrop click
    manualAttendanceModal.addEventListener('click', (e) => {
        if (e.target === manualAttendanceModal) {
            closeModal();
        }
    });
    
    // Form submission
    if (manualAttendanceForm) {
        manualAttendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
        // Manual Attendance Modal Logic
const manualAttendanceBtn = document.getElementById('manualAttendanceBtn');
const manualAttendanceModal = document.getElementById('manualAttendanceModal');
const cancelManualBtn = document.getElementById('cancelManual');
const confirmManualBtn = document.getElementById('confirmManual');
const manualError = document.getElementById('manualError');

// Open modal
manualAttendanceBtn?.addEventListener('click', () => {
    manualAttendanceModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    setTimeout(() => {
        document.getElementById('manualStudentName')?.focus();
    }, 100);
});

// Close modal function
function closeManualModal() {
    manualAttendanceModal.classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('manualStudentName').value = '';
    document.getElementById('manualGradeSection').value = '';
    manualError.classList.remove('show');
}

// Close events
cancelManualBtn?.addEventListener('click', closeManualModal);

// Close on backdrop click
manualAttendanceModal?.addEventListener('click', (e) => {
    if (e.target === manualAttendanceModal) {
        closeManualModal();
    }
});

// Submit attendance
confirmManualBtn?.addEventListener('click', async () => {
    const studentName = document.getElementById('manualStudentName').value.trim();
    const gradeSection = document.getElementById('manualGradeSection').value.trim();
    
    if (!studentName || !gradeSection) {
        showManualError('Please fill in all fields');
        return;
    }
    
    // Loading state
    confirmManualBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    confirmManualBtn.disabled = true;
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('You must be logged in');
        
        // Check approval
        const userRef = ref(database, 'users/' + user.uid);
        const userSnap = await get(userRef);
        
        if (!userSnap.exists() || userSnap.val().status !== 'approved') {
            throw new Error('Account pending admin approval');
        }
        
        // Save to Firebase
        await push(ref(database, 'attendance'), {
            studentName: studentName,
            grade: gradeSection,
            scannedBy: user.email,
            scannedByUid: user.uid,
            timestamp: new Date().toISOString(),
            type: 'manual'
        });
        
        // Success
        confirmManualBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
        confirmManualBtn.classList.add('success');
        
        setTimeout(() => {
            closeManualModal();
            confirmManualBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Attendance';
            confirmManualBtn.disabled = false;
            confirmManualBtn.classList.remove('success');
        }, 1500);
        
    } catch (error) {
        showManualError(error.message);
        confirmManualBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Attendance';
        confirmManualBtn.disabled = false;
    }
});

function showManualError(message) {
    manualError.querySelector('span').textContent = message;
    manualError.classList.add('show');
    setTimeout(() => manualError.classList.remove('show'), 5000);
}
// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('manualSuccess');
    if (successDiv) {
        successDiv.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
        successDiv.classList.add('show');
        setTimeout(() => successDiv.classList.remove('show'), 3000);
    } else {
        alert(message);
    }
}

// Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        if (userInfo) userInfo.classList.remove('hidden');
        if (userEmail) userEmail.textContent = user.email;
        if (loginBtn) loginBtn.classList.add('hidden');
        if (signupBtn) signupBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (qrScanner) qrScanner.classList.remove('hidden');
        
        // Check admin approval status
        checkUserStatus(user.uid);
    } else {
        // User is signed out
        if (userInfo) userInfo.classList.add('hidden');
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (signupBtn) signupBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (qrScanner) qrScanner.classList.add('hidden');
        if (attendanceHistory) attendanceHistory.classList.add('hidden');
    }
});

// Check user approval status
async function checkUserStatus(uid) {
    try {
        const userRef = ref(database, 'users/' + uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.status === 'approved') {
                if (attendanceHistory) attendanceHistory.classList.remove('hidden');
                loadAttendanceHistory();
            } else {
                showPendingApproval();
            }
        }
    } catch (error) {
        console.error('Error checking user status:', error);
    }
}

// Show pending approval message
function showPendingApproval() {
    const statusDiv = document.getElementById('approvalStatus');
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="pending-approval">
                <i class="fas fa-clock"></i>
                <p>Your account is pending admin approval.</p>
                <p>Please wait for an administrator to approve your access.</p>
            </div>
        `;
        statusDiv.classList.remove('hidden');
    }
}

// Load attendance history
function loadAttendanceHistory() {
    if (!historyList) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    const attendanceQuery = query(
        ref(database, 'attendance'),
        orderByChild('scannedByUid'),
        equalTo(user.uid)
    );
    
    onValue(attendanceQuery, (snapshot) => {
        historyList.innerHTML = '';
        
        if (snapshot.exists()) {
            const records = [];
            snapshot.forEach((childSnapshot) => {
                records.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // Sort by timestamp (newest first)
            records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            records.forEach((record) => {
                const date = new Date(record.timestamp);
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div class="history-info">
                        <span class="student-id">${record.studentId}</span>
                        <span class="student-name">${record.studentName || 'Unknown'}</span>
                        <span class="scan-type">${record.type === 'manual' ? '<i class="fas fa-keyboard"></i> Manual' : '<i class="fas fa-qrcode"></i> QR Scan'}</span>
                    </div>
                    <div class="history-time">
                        ${date.toLocaleDateString()} ${date.toLocaleTimeString()}
                    </div>
                `;
                historyList.appendChild(item);
            });
        } else {
            historyList.innerHTML = '<p class="no-records">No attendance records found</p>';
        }
    });
}

// Logout functionality
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log('User signed out');
        }).catch((error) => {
            console.error('Sign out error:', error);
        });
    });
}

// Initialize manual attendance when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initManualAttendance();
});

// QR Scanner functionality (placeholder - integrate with your QR library)
function initQRScanner() {
    // Your QR scanner initialization code here
    console.log('QR Scanner initialized');
}

export { auth, database };
