# PulseMobile

Mobile-first technician inspection workflow for the Pulse demo. This app lives independently from the main Pulse web dashboard.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

Open `http://localhost:5174`. The development server proxies `/api` requests to the Pulse API at `http://localhost:8080`.

The screen uses live readings when the API is available and sample readings when it is not. Inspection validation is submitted to `/api/alerts/P-101A/validation`. Selected photos stay on the device in this prototype and are not uploaded.

## Firebase Hosting

The Firebase Hosting configuration serves the Vite `dist` output as a single-page app. The current Pulse API is local-only, so a hosted build shows sample readings and cannot persist inspection submissions until an API is deployed separately.

From this directory, build and deploy with:

```sh
npm run build
npx firebase-tools login
npx firebase-tools deploy --only hosting --project pulse-c50cd
```

Firebase Hosting's Spark plan can serve static files without enabling billing. Do not upgrade the project to Blaze if you require a strict no-billing setup.

## Build

```sh
npm run build
```
