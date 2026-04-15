namespace com.hackathon.employee;

using { cuid, managed } from '@sap/cds/common';

entity Employees : cuid, managed {
    firstName    : String(50)  @mandatory;
    lastName     : String(50)  @mandatory;
    email        : String(100) @mandatory;
    department   : String(50);
    jobTitle     : String(100);
    hireDate     : Date;
    salary       : Decimal(12,2);
    status       : String(20) default 'Active';
    phoneNumber  : String(20);
    address      : String(200);
    managerId    : UUID;
}
