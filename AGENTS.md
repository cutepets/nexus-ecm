# Nexus ECM — working guide

Active development workspace. Source code and Prisma migrations are authoritative.

## Start here

- `docs/system-map.md`: architecture and local startup.
- `docs/DEV-NEXT.md`: open pilot inputs and acceptance evidence.
- `README.md`: product overview.

## Change rules

- Before editing a function, class, or method, run GitNexus upstream impact analysis. Report direct callers, affected flows, and risk; tell the user before proceeding on HIGH/CRITICAL risk.
- Use GitNexus query/context to navigate unfamiliar flows. Run change detection before committing; re-index after major changes. Preserve embeddings when re-indexing if any exist.
- Never rewrite an applied migration. Back up production data before migrations.
- Preserve existing local changes. Use synthetic demo data only; never put real employee biometrics, credentials, or personal data in seeds/tests.

## Current state

Core HR, attendance and rosters, leave, projects/tasks, documents, chat, payroll, settings, and integrations exist in the codebase. Development is ongoing; module presence is not proof of production readiness. Pilot setup and evidence in `docs/DEV-NEXT.md` remain outstanding.
