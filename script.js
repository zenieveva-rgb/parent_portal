import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, query, orderByChild, equalTo, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');
const qrScanner = document.getElementById('qrScanner');
const scanResult = document.getElementById('scanResult');
const attendanceHistory = document.getElementById('attendanceHistory');
const historyList = document.getElementById('historyList');

// Manual Attendance Elements
const manualAttendanceBtn = document.getElementById('manualAttendanceBtn');
const manualAttendanceModal = document.getElementById('manualAttendanceModal');
const cancelManualBtn = document.getElementById('cancelManual');
const confirmManualBtn = document.getElementById('confirmManual');
const manualError = document.getElementById('manualError');

// Initialize Manual Attendance
function initManualAttendance() {
    if (!manualAttendanceBtn || !manualAttendanceModal) {
        console.log('Manual attendance elements not found');
        return;
    }
    
    // Ensure modal is hidden on load
    manualAttendanceModal.classList.remove('active');
    manualAttendanceModal.style.display = 'none';
    
    // Open modal
    manualAttendanceBtn.addEventListener('click', () => {
        manualAttendanceModal.style.display = 'flex';
        // Force reflow
        void manualAttendanceModal.offsetWidth;
        manualAttendanceModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            const firstInput = document.getElementById('manualStudentName');
            if (firstInput) firstInput.focus();
        }, 100);
    });
    
    // Close modal function
    const closeModal = () => {
        manualAttendanceModal.classList.remove('active');
        setTimeout(() => {
            manualAttendanceModal.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';
        
        const nameInput = document.getElementById('manualStudentName');
        const gradeInput = document.getElementById('manualGradeSection');
        if (nameInput) nameInput.value = '';
        if (gradeInput) gradeInput.value = '';
        
        if (manualError) {
            manualError.classList.remove('show');
        }
    };
    
    if (cancelManualBtn) {
        cancelManualBtn.addEventListener('click', closeModal);
    }
    
    // Close on backdrop click
    manualAttendanceModal.addEventListener('click', (e) => {
        if (e.target === manualAttendanceModal) {
            closeModal();
        }
    });
    
    // Submit attendance
    if (confirmManualBtn) {
        confirmManualBtn.addEventListener('click', async () => {
            const studentName = document.getElementById('manualStudentName')?.value.trim();
            const gradeSection = document.getElementById('manualGradeSection')?.value.trim();
            
            if (!studentName || !gradeSection) {
                showManualError('Please fill in all fields');
                return;
            }
            
            const originalText = confirmManualBtn.innerHTML;
            confirmManualBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            confirmManualBtn.disabled = true;
            
            try {
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('You must be logged in to record attendance');
                }
                
                const userRef = ref(database, 'users/' + user.uid);
                const userSnapshot = await get(userRef);
                
                if (!userSnapshot.exists() || userSnapshot.val().status !== 'approved') {
                    throw new Error('Your account is pending admin approval');
                }
                
                const attendanceData = {
                    studentName: studentName,
                    grade: gradeSection,
                    scannedBy: user.email,
                    scannedByUid: user.uid,
                    timestamp: new Date().toISOString(),
                    type: 'manual'
                };
                
                const newAttendanceRef = push(ref(database, 'attendance'));
                await set(newAttendanceRef, attendanceData);
                
                confirmManualBtn.innerHTML = '<i class="fas fa-check"></i> Success!';
                
                setTimeout(() => {
                    closeModal();
                    confirmManualBtn.innerHTML = originalText;
                    confirmManualBtn.disabled = false;
                }, 1500);
                
            } catch (error) {
                console.error('Error recording attendance:', error);
                showManualError(error.message || 'Failed to record attendance');
                confirmManualBtn.innerHTML = originalText;
                confirmManualBtn.disabled = false;
            }
        });
    }
}

function showManualError(message) {
    if (manualError) {
        const span = manualError.querySelector('span');
        if (span) span.textContent = message;
        manualError.classList.add('show');
        setTimeout(() => manualError.classList.remove('show'), 5000);
    } else {
        alert(message);
    }
}

// Auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (userInfo) userInfo.classList.remove('hidden');
        if (userEmail) userEmail.textContent = user.email;
        if (loginBtn) loginBtn.classList.add('hidden');
        if (signupBtn) signupBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (qrScanner) qrScanner.classList.remove('hidden');
        
        checkUserStatus(user.uid);
    } else {
        if (userInfo) userInfo.classList.add('hidden');
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (signupBtn) signupBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (qrScanner) qrScanner.classList.add('hidden');
        if (attendanceHistory) attendanceHistory.classList.add('hidden');
    }
});

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
            
            records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            records.forEach((record) => {
                const date = new Date(record.timestamp);
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div class="history-info">
                        <span class="student-id">${record.studentId || ''}</span>
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

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log('User signed out');
        }).catch((error) => {
            console.error('Sign out error:', error);
        });
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initManualAttendance();
});

function initQRScanner() {
    console.log('QR Scanner initialized');
}

// Remove or comment out the export if not using modules
// export { auth, database };
