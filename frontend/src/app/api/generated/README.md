# api/generated

TypeScript client generated from the backend's OpenAPI spec. **Never hand-edit files here.**

It is empty until `npm run generate:api` is wired to a generator (a later slice, with its own
dependency choice). Until then, the few response types the app needs live next to the feature that
uses them (for example `features/public/home/ping.ts`) and are replaced once generation lands.
