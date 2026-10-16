# Pulse

Predictive maintenance that turns early warnings into safe, actionable maintenance.

Pulse demonstrates the complete human-in-the-loop workflow for a degrading transfer pump: detect a change against the asset's learned baseline, explain the evidence, record a technician's judgment, compare maintenance windows, and prepare a review-ready work order.

## Monorepo

```text
apps/web/       React, TypeScript, Vite dashboard
services/api/   Java 21, Spring Boot REST API
```

## Run locally

Requirements: Node.js 20+, npm, Java 21+, Maven 3.9+.

```sh
npm install
npm run dev
```

The dashboard is served at `http://localhost:5173`. The API runs at `http://localhost:8080`; API health is available at `/api/health` and the seeded scenario at `/api/overview`. Maven uses the project-local public Central mirror in `.mvn/settings.xml` and does not change your global Maven configuration.

To run either service separately, use `npm run dev:web` or `npm run dev:api`. To build the web app, run `npm run build`. To test the Java service, run `mvn -f services/api/pom.xml test`.

The local demo data is intentionally seeded around P-101A: 9 bar is its learned operating norm even though an old reference says 7 bar, while vibration, bearing temperature, and motor current indicate possible bearing degradation. The app only prepares work for authorized review; it does not approve permits or control equipment.