const cds = require('@sap/cds');

// Memory leak: Cached search results that are never cleared
const searchCache = new Map();

// In-memory junk buffer — grows on every READ to simulate OOM
const memoryBlackHole = [];

module.exports = cds.service.impl(async function (srv) {

    const { Employees } = this.entities;

    // Custom onboard action — creates employee and fires alert notification
    srv.on('onboardEmployee', async (req) => {
        const {
            firstName, lastName, email, department,
            jobTitle, hireDate, salary, phoneNumber, address
        } = req.data;

        if (!firstName || !lastName || !email) {
            req.error(400, 'firstName, lastName and email are required');
            return;
        }

        const existing = await SELECT.one.from(Employees).where({ email });
        if (existing) {
            req.error(409, `Employee with email ${email} already exists`);
            return;
        }

        const employee = await INSERT.into(Employees).entries({
            firstName, lastName, email, department,
            jobTitle, hireDate, salary, phoneNumber, address,
            status: 'Active'
        });

        const created = await SELECT.one.from(Employees).orderBy('createdAt desc');
        await sendOnboardNotification(req, created);
        return created;
    });

    srv.before('DELETE', Employees, async (req) => {
        const employee = await SELECT.one.from(Employees).where({ ID: req.params[0] });
        if (employee) await sendOffboardNotification(req, employee);
    });

    srv.after('UPDATE', Employees, async (data, req) => {
        if (data && data.status === 'Inactive') {
            await sendStatusChangeNotification(req, data);
        }
    });

    // OOM BUG: Load ALL 50k rows into memory on every READ, accumulate in global buffer
    srv.before('READ', Employees, async (req) => {
        const logger = cds.log('employee-service');

        try {
            const db = await cds.connect.to('db');

            // BUG: Fetch ALL rows (including 50k junk) regardless of query filters
            const allRows = await db.run(SELECT.from(Employees));
            logger.warn(`⚠️  Loaded ${allRows.length} rows into memory`);

            // BUG: Accumulate in global array — never released (simulates memory leak)
            const junkChunk = allRows.map(r => ({
                ...r,
                // Duplicate address blob to amplify memory usage
                _blob: Buffer.alloc(1024, r.address || 'X').toString('base64')
            }));
            memoryBlackHole.push(junkChunk);

            const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            logger.warn(`💀 memoryBlackHole size: ${memoryBlackHole.length} chunks | heapUsed: ${heapMB} MB`);

            // Simulate OutOfMemoryError once heap grows beyond threshold
            if (heapMB > 180 || memoryBlackHole.length >= 3) {
                const oomError = new Error(
                    `OutOfMemoryError: Java heap space — heapUsed=${heapMB}MB, ` +
                    `rows=${allRows.length}, chunks=${memoryBlackHole.length}`
                );
                oomError.code = 'OUT_OF_MEMORY';
                throw oomError;
            }

        } catch (err) {
            if (err.code === 'OUT_OF_MEMORY') {
                cds.log('employee-service').error('💥 OOM detected on GET /Employees:', err.message);

                // Fire BTP Alert Notification
                await sendOOMAlert(err);

                // Trigger GitHub Actions workflow via repository_dispatch
                await triggerGitHubAnalysis(err);

                req.error(503, `Service temporarily unavailable: ${err.message}`);
            } else {
                throw err;
            }
        }
    });
});

// ─── Alert Notification ───────────────────────────────────────────────────────

async function sendOOMAlert(err) {
    try {
        const alertSvc = await cds.connect.to('notifications');
        await alertSvc.send('notify', {
            type: 'sap.common.Alert',
            subject: '🚨 OutOfMemoryError on GET /employee/Employees',
            body: `The Employee Service has crashed with an OutOfMemoryError while serving GET /Employees.\n\nDetails: ${err.message}\n\nAutomatic log analysis has been triggered via GitHub Actions.`,
            priority: 'HIGH'
        });
        cds.log('alert-notification').info('✅ OOM alert sent via BTP Alert Notification');
    } catch (e) {
        cds.log('alert-notification').warn('Alert notification failed:', e.message);
    }
}

// ─── GitHub Actions trigger ───────────────────────────────────────────────────

async function triggerGitHubAnalysis(err) {
    const token = process.env.GH_PAT;
    if (!token) {
        cds.log('github').warn('GH_PAT not set — skipping workflow trigger');
        return;
    }

    try {
        const https = require('https');
        const payload = JSON.stringify({
            event_type: 'oom-detected',
            client_payload: {
                error: err.message,
                timestamp: new Date().toISOString(),
                service: 'employee-service',
                endpoint: 'GET /employee/Employees'
            }
        });

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.github.com',
                path: '/repos/biznetworkhackathon2026/employee-service/dispatches',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'employee-service-cap',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                cds.log('github').info(`✅ GitHub dispatch triggered — HTTP ${res.statusCode}`);
                resolve();
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    } catch (e) {
        cds.log('github').warn('GitHub dispatch failed:', e.message);
    }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

async function sendOnboardNotification(req, employee) {
    try {
        const alertSvc = await cds.connect.to('notifications');
        await alertSvc.send('notify', {
            type: 'sap.common.Alert',
            subject: `New Employee Onboarded: ${employee.firstName} ${employee.lastName}`,
            body: `Employee ${employee.firstName} ${employee.lastName} (${employee.email}) has been onboarded as ${employee.jobTitle} in ${employee.department}.`,
            priority: 'LOW'
        });
    } catch (err) {
        cds.log('alert-notification').warn('Onboard notification failed:', err.message);
    }
}

async function sendOffboardNotification(req, employee) {
    try {
        const alertSvc = await cds.connect.to('notifications');
        await alertSvc.send('notify', {
            type: 'sap.common.Alert',
            subject: `Employee Offboarded: ${employee.firstName} ${employee.lastName}`,
            body: `Employee ${employee.firstName} ${employee.lastName} (${employee.email}) has been removed from the system.`,
            priority: 'MEDIUM'
        });
    } catch (err) {
        cds.log('alert-notification').warn('Offboard notification failed:', err.message);
    }
}

async function sendStatusChangeNotification(req, employee) {
    try {
        const alertSvc = await cds.connect.to('notifications');
        await alertSvc.send('notify', {
            type: 'sap.common.Alert',
            subject: `Employee Status Changed: ${employee.firstName} ${employee.lastName}`,
            body: `Employee ${employee.firstName} ${employee.lastName} status has been updated to Inactive.`,
            priority: 'MEDIUM'
        });
    } catch (err) {
        cds.log('alert-notification').warn('Status change notification failed:', err.message);
    }
}
