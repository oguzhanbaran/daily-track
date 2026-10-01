# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Shared meeting setup

The app can synchronize one shared meeting through Firebase Realtime Database.

1. Create a Firebase project and a Realtime Database.
2. In Realtime Database > Rules, paste the contents of `database.rules.json` and publish the rules. This makes `rooms/daily-track` readable and writable by anyone on the internet.
3. Register a Web app in Project settings and copy its Firebase config.
4. In GitHub, open Settings > Secrets and variables > Actions > Variables. Add repository variables named `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` using the matching Firebase Web app values.
5. Push a commit or run the Deploy to GitHub Pages workflow. Everyone opening the deployed site will then share the same meeting state.

For local development, copy `.env.example` to `.env.local` and add the same values. Without Firebase config, the app uses browser-local storage only.

The shared room is intentionally public: anyone who knows the site can read and change its participant state. Do not store private information in the room.
