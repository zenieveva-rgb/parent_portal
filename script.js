import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
    
    // Open modal
    manualAttendanceBtn.addEventListener('click', () => {
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
        if (e.target === manualAttendanceModal || e.target.classList.contains('manual-modal-backdrop')) {
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initManualAttendance();
});
