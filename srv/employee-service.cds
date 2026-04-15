using com.hackathon.employee as emp from '../db/schema';

service EmployeeService @(path:'/employee') {

    entity Employees as projection on emp.Employees;

    action onboardEmployee(
        firstName   : String,
        lastName    : String,
        email       : String,
        department  : String,
        jobTitle    : String,
        hireDate    : Date,
        salary      : Decimal,
        phoneNumber : String,
        address     : String
    ) returns Employees;
}

annotate EmployeeService.Employees with @(
    UI.LineItem: [
        { Value: firstName,   Label: 'First Name' },
        { Value: lastName,    Label: 'Last Name' },
        { Value: email,       Label: 'Email' },
        { Value: department,  Label: 'Department' },
        { Value: jobTitle,    Label: 'Job Title' },
        { Value: hireDate,    Label: 'Hire Date' },
        { Value: status,      Label: 'Status' }
    ],
    UI.HeaderInfo: {
        TypeName: 'Employee',
        TypeNamePlural: 'Employees',
        Title: { Value: firstName },
        Description: { Value: jobTitle }
    },
    UI.Facets: [{
        $Type: 'UI.ReferenceFacet',
        Label: 'Employee Details',
        Target: '@UI.FieldGroup#Details'
    }],
    UI.FieldGroup#Details: {
        Data: [
            { Value: firstName },
            { Value: lastName },
            { Value: email },
            { Value: department },
            { Value: jobTitle },
            { Value: hireDate },
            { Value: salary },
            { Value: phoneNumber },
            { Value: address },
            { Value: status }
        ]
    }
);
