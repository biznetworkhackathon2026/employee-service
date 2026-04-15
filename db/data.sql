-- Sample seed data
INSERT INTO com_hackathon_employee_Employees (ID, firstName, lastName, email, department, jobTitle, hireDate, salary, status, phoneNumber, address, createdAt, createdBy, modifiedAt, modifiedBy)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice', 'Johnson', 'alice.johnson@example.com', 'Engineering', 'Senior Developer', '2022-03-15', 95000.00, 'Active', '+1-555-0101', '123 Main St, San Jose, CA', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('22222222-2222-2222-2222-222222222222', 'Bob', 'Smith', 'bob.smith@example.com', 'HR', 'HR Manager', '2021-06-01', 80000.00, 'Active', '+1-555-0102', '456 Oak Ave, San Jose, CA', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system'),
  ('33333333-3333-3333-3333-333333333333', 'Carol', 'Williams', 'carol.williams@example.com', 'Finance', 'Financial Analyst', '2023-01-10', 75000.00, 'Active', '+1-555-0103', '789 Pine Rd, San Jose, CA', CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, 'system');
