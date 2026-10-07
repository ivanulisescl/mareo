# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Cursor Cloud specific instructions

- Expo SDK 57 needs Node.js 22.13 or newer. It is already on `PATH` in this environment.
- Web dev server, from this repo: `CI=1 BROWSER=none EXPO_NO_TELEMETRY=1 npx expo start --web --host localhost --port 8081`. Open `http://localhost:8081/`. With `--host localhost`, Metro listens on IPv6, so `localhost` works and `127.0.0.1` does not.
- `experiments.baseUrl` (`/mareo`) applies to `npx expo export -p web`. The dev server serves the app at `/`.
- Checks: `npx tsc --noEmit` and `npx expo export -p web`.
- The default place is Colunga. Gijón is the other fixed coast. Forecasts come from `api.open-meteo.com` and `marine-api.open-meteo.com`.
- Sibling apps in this multi-repo workspace: MontiandoApp on port 5173 (`npx vite --host 127.0.0.1 --port 5173 --strictPort`); keepy, libros and MiRecetario are static and use `python3 -m http.server` on 4173, 4174 and 4175. Montiando photos need `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env.local`. The route diary loads without them.
