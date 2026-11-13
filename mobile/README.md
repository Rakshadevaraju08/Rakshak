# Mobile app

The mobile app is a lightweight citizen-facing SOS experience for reporting emergencies and sharing location data quickly. It is designed to work both online and offline, retaining queued SOS requests when connectivity is unavailable.

## Functional overview

The app includes:

- Geolocation capture with a fallback message when GPS is unavailable
- Category-based incident reporting such as Medical, Flood, Fire, and Trapped
- Hold-to-send SOS interaction to reduce accidental alerts
- Local queueing of unsent SOS messages
- Automatic sync when the device reconnects to the internet

## Application structure

```text
mobile/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── services/
│   └── styles.css
└── README.md
```

## SOS workflow

The main workflow lives in `mobile/src/App.tsx`:

1. The app requests browser geolocation.
2. The user selects an emergency category and writes summary details.
3. The user presses and holds the SOS button until the threshold is met.
4. The app stores the message in a local queue and attempts to sync with the backend when online.
5. The queue remains stored locally until a successful backend sync is confirmed.

## Offline queue and retry behavior

The queue logic is implemented in `mobile/src/services/queue.ts`.

Behavior:

- `enqueueSOS` stores the request locally when the device is offline or while awaiting delivery.
- `syncQueue` sends pending messages to the backend when connectivity is restored.
- `getQueueCount` reports how many queued requests remain.
- The UI updates the status text to reflect saved and accepted messages.

This is an offline-first safety mechanism rather than a full mesh relay implementation.

## Backend communication

The app targets the backend incident API and expects the backend to be running on the local API host.

Typical endpoints used by the client flow:

- `POST /api/sos` for emergency reports
- `GET /api/incidents` for incident listing
- `POST /api/mesh/sync` for offline queue reconciliation

## Local development

```bash
cd mobile
npm install
npm run dev
```

The app is a mobile-first web app; use a browser emulator or mobile viewport for functional testing.

## Production build

```bash
cd mobile
npm run build
```

## Operational notes

- The mobile app should remain resilient when cellular or Wi-Fi connectivity fluctuates.
- The queue is a practical offline fallback and may be extended to true mesh-based relay behavior when the architecture evolves.
- Do not treat the current app as a production-grade native mobile app; it is a browser-based citizen SOS prototype.
