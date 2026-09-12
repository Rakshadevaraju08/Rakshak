# DisasterLink mobile web app

A standalone, mobile-first Citizen SOS website. It uses device geolocation when permission is granted and offers an intentional hold-to-send SOS control.

## Run

```bash
npm install
npm run dev
```

Build it for production with `npm run build`.

The UI currently keeps an SOS request in the client flow; connect the dispatch function in `src/App.tsx` to the backend incident endpoint when that API is available.

## Purpose
The mobile app allows citizens to submit SOS requests, capture their location, and send them to the disaster response system.

## Offline Mesh (Planned)
During disasters, infrastructure may fail. This app will eventually support storing messages locally in SQLite and passing them through nearby devices using Bluetooth Low Energy (BLE) until it reaches a device with internet access.

## Next Steps for Mobile Developer
Before initializing the project (Expo Go vs. Bare React Native), investigate the BLE library requirements. Some BLE implementations require native build access which Expo Go does not support out of the box without a custom dev client.

Document your findings in `../docs/TEAM_TASKS.md` before starting.
