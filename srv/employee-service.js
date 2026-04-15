const cds = require('@sap/cds');

module.exports = cds.service.impl(async function (srv) {

    const { Employees } = this.entities;

    // Custom onboard action — creates employee and fires alert notification
    srv.on('onboardEmployee', async (req) => {
        const {
            firstName, lastName, email, department,
            jobTitle, hireDate, salary, phoneNumber, address
        } = req.data;

        // Validate required fields
        if (!firstName || !lastName || !email) {
            req.error(400, 'firstName, lastName and email are required');
            return;
        }

        // Check for duplicate email
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

        // Send alert notification on new employee onboard
        await sendOnboardNotification(req, created);

        return created;
    });

    // Before DELETE: send notification about offboarding
    srv.before('DELETE', Employees, async (req) => {
        const employee = await SELECT.one.from(Employees).where({ ID: req.params[0] });
        if (employee) {
            await sendOffboardNotification(req, employee);
        }
    });

    // After UPDATE: notify on status change
    srv.after('UPDATE', Employees, async (data, req) => {
        if (data && data.status === 'Inactive') {
            await sendStatusChangeNotification(req, data);
        }
    });
});

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
        // Notification failure is non-blocking
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
