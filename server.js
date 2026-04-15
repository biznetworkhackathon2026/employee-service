const cds = require('@sap/cds');

// Seed sample data + junk rows after server is ready
cds.on('served', async () => {
    const db = await cds.connect.to('db');
    const { Employees } = cds.entities('com.hackathon.employee');
    try {
        const { n } = await db.run(SELECT.one`count(*) as n`.from(Employees));
        if (!n || parseInt(n) === 0) {
            // Seed 3 real employees
            await db.run(INSERT.into(Employees).entries([
                {
                    ID: '11111111-1111-1111-1111-111111111111',
                    firstName: 'Alice', lastName: 'Johnson',
                    email: 'alice.johnson@example.com',
                    department: 'Engineering', jobTitle: 'Senior Developer',
                    hireDate: '2022-03-15', salary: 95000, status: 'Active',
                    phoneNumber: '+1-555-0101', address: '123 Main St, San Jose, CA'
                },
                {
                    ID: '22222222-2222-2222-2222-222222222222',
                    firstName: 'Bob', lastName: 'Smith',
                    email: 'bob.smith@example.com',
                    department: 'HR', jobTitle: 'HR Manager',
                    hireDate: '2021-06-01', salary: 80000, status: 'Active',
                    phoneNumber: '+1-555-0102', address: '456 Oak Ave, San Jose, CA'
                },
                {
                    ID: '33333333-3333-3333-3333-333333333333',
                    firstName: 'Carol', lastName: 'Williams',
                    email: 'carol.williams@example.com',
                    department: 'Finance', jobTitle: 'Financial Analyst',
                    hireDate: '2023-01-10', salary: 75000, status: 'Active',
                    phoneNumber: '+1-555-0103', address: '789 Pine Rd, San Jose, CA'
                }
            ]));
            cds.log('seed').info('✅ Real employees seeded');

            // Seed 50,000 junk rows to simulate bloated production DB
            cds.log('seed').warn('⚠️  Seeding 50,000 junk employees to simulate memory pressure...');
            const BATCH = 500;
            const TOTAL = 50000;
            for (let i = 0; i < TOTAL; i += BATCH) {
                const batch = [];
                for (let j = i; j < Math.min(i + BATCH, TOTAL); j++) {
                    batch.push({
                        firstName: `Junk_${j}`,
                        lastName: `Row_${j}`,
                        email: `junk_${j}@loadtest.internal`,
                        department: 'LoadTest',
                        jobTitle: 'Ghost Employee',
                        hireDate: '2020-01-01',
                        salary: 0,
                        status: 'Inactive',
                        phoneNumber: '+0-000-0000',
                        // Large address string to bloat memory per row
                        address: 'X'.repeat(512) + ` row=${j}`
                    });
                }
                await db.run(INSERT.into(Employees).entries(batch));
            }
            cds.log('seed').warn(`💣 Junk seed complete — ${TOTAL} rows inserted`);
        }
    } catch (e) {
        cds.log('seed').warn('Seed skipped:', e.message);
    }
});

module.exports = cds.server;
