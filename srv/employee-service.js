const cds = require('@sap/cds');

const searchCache = new Map();
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

    srv.before('READ', Employees, async (req) => {
        const logger = cds.log('employee-service');

        const ioError = new Error(
            'IOException: Failed to read from data source — ' +
            'connection reset by peer while streaming employee records'
        );
        ioError.code = 'IO_EXCEPTION';

        logger.error('IOException on GET /Employees:', ioError.message);

        await sendAlertNotification(ioError);
        await triggerGitHubAnalysis(ioError);

        req.error(503, `Service temporarily unavailable: ${ioError.message}`);
    });
});

// ─── Alert Notification ───────────────────────────────────────────────────────

async function sendAlertNotification(err) {
    try {
        const alertSvc = await cds.connect.to('notifications');
        await alertSvc.send('notify', {
            type: 'sap.common.Alert',
            subject: 'Production alert on GET /employee/Employees',
            body: `The Employee Service encountered an error serving GET /Employees.\n\nDetails: ${err.message}\n\nAutomatic log analysis has been triggered.`,
            priority: 'HIGH'
        });
        cds.log('alert-notification').info('Alert sent via BTP Alert Notification');
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
            event_type: 'service-alert',
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
