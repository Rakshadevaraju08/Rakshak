# Mobile Application (Citizen SOS)

This directory will contain the mobile application source code.

## Purpose
The mobile app allows citizens to submit SOS requests, capture their location, and send them to the disaster response system.

## Offline Mesh (Planned)
During disasters, infrastructure may fail. This app will eventually support storing messages locally in SQLite and passing them through nearby devices using Bluetooth Low Energy (BLE) until it reaches a device with internet access.

## Next Steps for Mobile Developer
Before initializing the project (Expo Go vs. Bare React Native), investigate the BLE library requirements. Some BLE implementations require native build access which Expo Go does not support out of the box without a custom dev client.

Document your findings in `../docs/TEAM_TASKS.md` before starting.
