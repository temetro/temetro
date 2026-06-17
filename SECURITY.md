# Security Policy

## Supported versions

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email **khalidstudentxv@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations (optional)

You will receive an acknowledgement within 48 hours and a status update within 7 days.

## Scope

temetro handles clinical data. Reports in the following areas are treated as high priority:

- Authentication or session bypass
- Unauthorized access to patient records across clinic tenants
- Data injection (SQL, XSS, command injection)
- Exposure of credentials or secrets

## Out of scope

- Vulnerabilities in dependencies that have already been publicly disclosed and are pending an upstream fix
- Theoretical issues with no practical exploit path
- Issues in the patient companion app or blockchain signing layer (not yet built)
