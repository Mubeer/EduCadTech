// ========================================================
// EduCadTech Course Enrollment & Demo Payment Client Script
// ========================================================

let selectedCourse = null;
let currentRegistration = null;

// Inject modal HTML into DOM on load
document.addEventListener('DOMContentLoaded', () => {
    initEnrollmentModal();
});

function initEnrollmentModal() {
    if (document.getElementById('enrollModalOverlay')) return;

    const modalHtml = `
    <div id="enrollModalOverlay" class="enroll-modal-overlay">
        <div class="enroll-modal-content">
            <button class="enroll-modal-close" onclick="closeEnrollModal()">&times;</button>
            
            <!-- STEP 1: Registration Form -->
            <div id="enrollStep1" class="enroll-step">
                <div class="enroll-modal-header">
                    <span class="sub-badge">Course Registration</span>
                    <h3 id="modalCourseTitle">Course Enrollment</h3>
                    <p style="color: #64748b; font-size: 13.5px; margin-top: 4px;">
                        Complete your details to register. Certificate eligibility will be calculated automatically based on duration.
                    </p>
                </div>

                <div class="course-brief-box">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Course Fee</div>
                            <div id="modalCoursePrice" style="font-size: 22px; font-weight: 700; color: #ac192b;">₹4,999</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Duration</div>
                            <div id="modalCourseDuration" style="font-size: 15px; font-weight: 600; color: #1e293b;">3 Months</div>
                        </div>
                    </div>
                </div>

                <form id="enrollForm" onsubmit="submitRegistration(event)">
                    <div class="form-group mb-15">
                        <label class="enroll-label">Student Full Name *</label>
                        <input type="text" id="regStudentName" class="form-control" placeholder="e.g. Priya Sharma" required>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group mb-15">
                            <label class="enroll-label">Email Address *</label>
                            <input type="email" id="regEmail" class="form-control" placeholder="e.g. priya@example.com" required>
                        </div>
                        <div class="col-md-6 form-group mb-15">
                            <label class="enroll-label">Phone Number *</label>
                            <input type="text" id="regPhone" class="form-control" placeholder="e.g. +91 9876543210" required>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group mb-15">
                            <label class="enroll-label">WhatsApp Number</label>
                            <input type="text" id="regWhatsApp" class="form-control" placeholder="For automated status link">
                        </div>
                        <div class="col-md-6 form-group mb-15">
                            <label class="enroll-label">Training Delivery Mode</label>
                            <select id="regMode" class="form-control">
                                <option value="online">Online Live Interactive</option>
                                <option value="offline">In-Person Classroom</option>
                            </select>
                        </div>
                    </div>

                    <div id="step1Error" class="alert-box alert-danger" style="display: none;"></div>

                    <div style="margin-top: 20px; text-align: right;">
                        <button type="button" class="readon transparent-btn" onclick="closeEnrollModal()" style="padding: 10px 20px; border: 1px solid #cbd5e1; color: #475569; margin-right: 8px;">Cancel</button>
                        <button type="submit" id="proceedPayBtn" class="readon orange-btn" style="padding: 10px 28px; border-radius: 6px;">
                            Proceed to Demo Payment <i class="fa fa-arrow-right"></i>
                        </button>
                    </div>
                </form>
            </div>

            <!-- STEP 2: Demo Payment Gateway -->
            <div id="enrollStep2" class="enroll-step" style="display: none;">
                <div class="demo-gateway-banner">
                    <i class="fa fa-shield"></i>
                    <div>
                        <strong>DEMO PAYMENT GATEWAY (SIMULATED)</strong><br>
                        <span>No real bank account or money will be charged. Choose a simulated outcome to test gateway callbacks.</span>
                    </div>
                </div>

                <div class="payment-order-summary">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Registration Reference</div>
                            <div id="payOrderRef" style="font-size: 15px; font-weight: 700; color: #0f172a;">REG-2026-XXXXX</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Amount Due</div>
                            <div id="payOrderAmount" style="font-size: 20px; font-weight: 700; color: #16a34a;">₹4,999</div>
                        </div>
                    </div>
                </div>

                <!-- Payment Method Simulation Tabs -->
                <div class="pay-method-tabs">
                    <div class="pay-tab active" onclick="switchPayTab(this, 'card')"><i class="fa fa-credit-card"></i> Card</div>
                    <div class="pay-tab" onclick="switchPayTab(this, 'upi')"><i class="fa fa-mobile"></i> UPI / QR</div>
                    <div class="pay-tab" onclick="switchPayTab(this, 'netbanking')"><i class="fa fa-bank"></i> Net Banking</div>
                </div>

                <!-- Card UI -->
                <div id="payMethodCard" class="pay-method-view">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Demo Test Card Number</div>
                        <div style="font-family: monospace; font-size: 16px; font-weight: 600; color: #1e293b; letter-spacing: 2px;">
                            4111 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 1111
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: #64748b;">
                            <span>EXP: 12/28</span>
                            <span>CVV: &bull;&bull;&bull;</span>
                            <span>DEMO VISA</span>
                        </div>
                    </div>
                </div>

                <!-- UPI UI -->
                <div id="payMethodUpi" class="pay-method-view" style="display: none;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; text-align: center;">
                        <i class="fa fa-qrcode" style="font-size: 40px; color: #1e293b; margin-bottom: 6px;"></i>
                        <div style="font-size: 13px; font-weight: 600; color: #1e293b;">Virtual Payment Address: <code>educadtech@demo-upi</code></div>
                    </div>
                </div>

                <!-- NetBanking UI -->
                <div id="payMethodNetbanking" class="pay-method-view" style="display: none;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; font-size: 13px; color: #64748b;">
                        Simulated Net Banking Portal (HDFC / ICICI / SBI Test Gateway)
                    </div>
                </div>

                <div id="step2Error" class="alert-box alert-danger" style="display: none;"></div>

                <!-- Action Outcome Buttons -->
                <div style="margin-top: 20px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">
                        Select Demo Gateway Outcome:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button type="button" class="btn-demo-pay btn-demo-success" onclick="processDemoPayment('success')">
                            <i class="fa fa-check-circle"></i> Simulate Successful Payment (Approved)
                        </button>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn-demo-pay btn-demo-failed" style="flex: 1;" onclick="processDemoPayment('failed')">
                                <i class="fa fa-times-circle"></i> Simulate Failure (Declined)
                            </button>
                            <button type="button" class="btn-demo-pay btn-demo-cancel" style="flex: 1;" onclick="processDemoPayment('cancelled')">
                                <i class="fa fa-ban"></i> Simulate Cancelled
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- STEP 3: Confirmation -->
            <div id="enrollStep3" class="enroll-step" style="display: none; text-align: center;">
                <div class="success-icon-wrap">
                    <i class="fa fa-check"></i>
                </div>
                <h3 style="font-size: 22px; font-weight: 700; color: #166534; margin-bottom: 6px;">Registration &amp; Payment Confirmed!</h3>
                <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">
                    Thank you! Your enrollment record and demo transaction have been securely recorded in the platform database.
                </p>

                <div class="confirmed-receipt-box">
                    <div class="receipt-row">
                        <span>Registration Reference:</span>
                        <strong id="confRegCode" style="color: #ac192b;">REG-2026-XXXXX</strong>
                    </div>
                    <div class="receipt-row">
                        <span>Student Name:</span>
                        <strong id="confStudentName">Priya Sharma</strong>
                    </div>
                    <div class="receipt-row">
                        <span>Course Enrolled:</span>
                        <strong id="confCourseTitle">Course Name</strong>
                    </div>
                    <div class="receipt-row">
                        <span>Transaction ID:</span>
                        <code id="confTxnRef">TXN-DEMO-XXXXXX</code>
                    </div>
                    <div class="receipt-row">
                        <span>Fee Paid:</span>
                        <strong id="confAmount" style="color: #16a34a;">₹4,999</strong>
                    </div>
                    <div class="receipt-row">
                        <span>Certificate Eligibility Date:</span>
                        <strong id="confEligDate">YYYY-MM-DD</strong>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 25px;">
                    <a id="confWaBtn" href="#" target="_blank" class="readon orange-btn" style="padding: 10px 22px; font-size: 13.5px; background: #25D366; border-color: #25D366;">
                        <i class="fa fa-whatsapp"></i> WhatsApp Confirmation
                    </a>
                    <a href="certificate.html" class="readon transparent-btn" style="padding: 10px 22px; font-size: 13.5px; border: 1px solid #ac192b; color: #ac192b;">
                        <i class="fa fa-certificate"></i> View Certificate Portal
                    </a>
                    <button type="button" class="readon transparent-btn" onclick="closeEnrollModal()" style="padding: 10px 22px; font-size: 13.5px; border: 1px solid #cbd5e1; color: #475569;">
                        Done
                    </button>
                </div>
            </div>

        </div>
    </div>
    `;

    // Append to body
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);

    // Append CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .enroll-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
            opacity: 0;
            visibility: hidden;
            transition: all 0.25s ease;
        }
        .enroll-modal-overlay.active {
            opacity: 1;
            visibility: visible;
        }
        .enroll-modal-content {
            background: #ffffff;
            border-radius: 12px;
            width: 100%;
            max-width: 560px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 30px;
            position: relative;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
        }
        .enroll-modal-close {
            position: absolute;
            top: 18px;
            right: 20px;
            background: transparent;
            border: none;
            font-size: 26px;
            color: #94a3b8;
            cursor: pointer;
            line-height: 1;
        }
        .enroll-modal-close:hover { color: #0f172a; }
        .sub-badge {
            background: #fff7ed;
            color: #ac192b;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 3px 10px;
            border-radius: 20px;
            display: inline-block;
            margin-bottom: 6px;
        }
        .course-brief-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 20px;
        }
        .enroll-label {
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 5px;
            display: block;
        }
        .demo-gateway-banner {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 12px 14px;
            color: #1e40af;
            font-size: 12.5px;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
        }
        .demo-gateway-banner i { font-size: 22px; color: #3b82f6; }
        .payment-order-summary {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 16px;
        }
        .pay-method-tabs {
            display: flex;
            border-bottom: 2px solid #e2e8f0;
            margin-bottom: 15px;
        }
        .pay-tab {
            flex: 1;
            text-align: center;
            padding: 10px;
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
        }
        .pay-tab.active {
            color: #ac192b;
            border-bottom-color: #ac192b;
        }
        .btn-demo-pay {
            width: 100%;
            padding: 11px;
            border-radius: 6px;
            font-size: 13.5px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .btn-demo-success {
            background: #10b981;
            color: #fff;
        }
        .btn-demo-success:hover { background: #059669; }
        .btn-demo-failed {
            background: #fee2e2;
            color: #b91c1c;
            border-color: #fca5a5;
        }
        .btn-demo-failed:hover { background: #fecaca; }
        .btn-demo-cancel {
            background: #f1f5f9;
            color: #475569;
            border-color: #cbd5e1;
        }
        .btn-demo-cancel:hover { background: #e2e8f0; }
        .success-icon-wrap {
            width: 65px;
            height: 65px;
            border-radius: 50%;
            background: #dcfce7;
            color: #16a34a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 15px;
            border: 2px solid #16a34a;
        }
        .confirmed-receipt-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 20px;
            text-align: left;
            font-size: 13.5px;
        }
        .receipt-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px dashed #e2e8f0;
        }
        .receipt-row:last-child { border-bottom: none; }
        .alert-box {
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 13px;
            margin-top: 12px;
        }
        .alert-danger {
            background: #fef2f2;
            border: 1px solid #f87171;
            color: #b91c1c;
        }
        .btn-enroll-card {
            display: inline-block;
            background: #ac192b;
            color: #fff !important;
            padding: 6px 16px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none !important;
            transition: all 0.2s;
            cursor: pointer;
        }
        .btn-enroll-card:hover {
            background: #8f1221;
            box-shadow: 0 4px 10px rgba(172, 25, 43, 0.3);
        }
    `;
    document.head.appendChild(style);
}

// Attach Enroll Now buttons to existing course cards
async function attachEnrollButtons() {
    try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        const apiCourses = data.courses || [];

        const items = document.querySelectorAll('.courses-item');
        items.forEach((item, idx) => {
            const titleEl = item.querySelector('.title');
            if (!titleEl) return;
            const title = titleEl.textContent.trim();

            const course = apiCourses.find(c => c.title.toLowerCase() === title.toLowerCase()) || apiCourses[idx % apiCourses.length];

            const btnPart = item.querySelector('.btn-part');
            if (btnPart) {
                btnPart.innerHTML = `
                    <button class="btn-enroll-card" onclick="openEnrollForCourse(${course ? course.id : 1}, '${escapeJs(title)}', ${course ? course.price : 4999}, ${course ? course.duration_months : 3})">
                        Enroll Now <i class="fa fa-arrow-right"></i>
                    </button>
                `;
            }
        });
    } catch (e) {
        console.error('Error fetching courses for buttons:', e);
    }
}

function openEnrollForCourse(id, title, price, duration) {
    if (!document.getElementById('enrollModalOverlay')) {
        initEnrollmentModal();
    }
    selectedCourse = { id, title, price, duration };

    const titleEl = document.getElementById('modalCourseTitle');
    const priceEl = document.getElementById('modalCoursePrice');
    const durationEl = document.getElementById('modalCourseDuration');

    if (titleEl) titleEl.textContent = title;
    if (priceEl) priceEl.textContent = `₹${Number(price).toLocaleString()}`;
    if (durationEl) durationEl.textContent = `${duration} Months`;

    // Reset steps
    const step1 = document.getElementById('enrollStep1');
    const step2 = document.getElementById('enrollStep2');
    const step3 = document.getElementById('enrollStep3');
    const errBox = document.getElementById('step1Error');

    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';
    if (errBox) errBox.style.display = 'none';

    const overlay = document.getElementById('enrollModalOverlay');
    if (overlay) overlay.classList.add('active');
}

window.openEnrollForCourse = openEnrollForCourse;

function closeEnrollModal() {
    const el = document.getElementById('enrollModalOverlay');
    if (el) el.classList.remove('active');
}

async function submitRegistration(e) {
    e.preventDefault();
    const btn = document.getElementById('proceedPayBtn');
    const errBox = document.getElementById('step1Error');
    errBox.style.display = 'none';

    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Initializing Enrollment...';

    const payload = {
        student_name: document.getElementById('regStudentName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        whatsapp: document.getElementById('regWhatsApp').value.trim(),
        course_id: selectedCourse.id,
        course_type: document.getElementById('regMode').value
    };

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        currentRegistration = data.registration;

        // Transition to Step 2: Payment
        document.getElementById('payOrderRef').textContent = currentRegistration.reg_code;
        document.getElementById('payOrderAmount').textContent = `₹${Number(selectedCourse.price).toLocaleString()}`;

        document.getElementById('enrollStep1').style.display = 'none';
        document.getElementById('enrollStep2').style.display = 'block';
    } catch (err) {
        errBox.textContent = err.message || 'Error creating registration';
        errBox.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Proceed to Demo Payment <i class="fa fa-arrow-right"></i>';
    }
}

function switchPayTab(el, method) {
    document.querySelectorAll('.pay-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    document.getElementById('payMethodCard').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('payMethodUpi').style.display = method === 'upi' ? 'block' : 'none';
    document.getElementById('payMethodNetbanking').style.display = method === 'netbanking' ? 'block' : 'none';
}

async function processDemoPayment(outcome) {
    const errBox = document.getElementById('step2Error');
    errBox.style.display = 'none';

    try {
        const res = await fetch('/api/payments/process-demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                registration_id: currentRegistration.id,
                payment_method: 'demo_card',
                demo_outcome: outcome
            })
        });
        const data = await res.json();

        if (outcome === 'success') {
            if (!data.success) throw new Error(data.error || 'Payment failed.');

            // Fill Confirmation screen
            document.getElementById('confRegCode').textContent = data.reg_code;
            document.getElementById('confStudentName').textContent = data.student_name;
            document.getElementById('confCourseTitle').textContent = data.course_title;
            document.getElementById('confTxnRef').textContent = data.transaction_ref;
            document.getElementById('confAmount').textContent = `₹${Number(data.amount).toLocaleString()}`;
            document.getElementById('confEligDate').textContent = data.eligibility_date;

            // WhatsApp link
            const phone = (currentRegistration.whatsapp || currentRegistration.phone).replace(/[^0-9]/g, '');
            const waText = encodeURIComponent(`Hi ${data.student_name}, your enrollment in ${data.course_title} (Ref: ${data.reg_code}) is confirmed!`);
            document.getElementById('confWaBtn').href = `https://wa.me/${phone}?text=${waText}`;

            // Transition to Step 3
            document.getElementById('enrollStep2').style.display = 'none';
            document.getElementById('enrollStep3').style.display = 'block';

        } else if (outcome === 'failed') {
            errBox.textContent = data.message || 'Payment simulation failed. Card was declined.';
            errBox.style.display = 'block';
        } else {
            errBox.textContent = data.message || 'Payment simulation was cancelled.';
            errBox.style.display = 'block';
        }
    } catch (err) {
        errBox.textContent = err.message || 'Error processing demo payment';
        errBox.style.display = 'block';
    }
}

function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
