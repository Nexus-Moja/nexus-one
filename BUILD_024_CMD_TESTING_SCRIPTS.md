# Build 024 — Command Prompt Testing Scripts

Build 024 adds Windows Command Prompt-friendly scripts for building, testing, restarting, and refreshing the NEXUS ONE application.

## Commands

```cmd
npm run dev
```
Builds the application and starts the production server.

```cmd
npm run dev:vite
```
Starts the original Vite development server without building first.

```cmd
npm test
```
Runs the Livecare, AI operations, executive, production foundation, and internationalization test suites.

```cmd
npm run test-build
```
Runs all tests and then creates a production build.

```cmd
npm run restart
```
Stops active Node.js processes, rebuilds the application, and starts the server.

```cmd
npm run refresh
```
Stops active Node.js processes, runs all tests, rebuilds the application, and starts the server.

> `restart` and `refresh` use the Windows `taskkill` command and are intended for Command Prompt or PowerShell on Windows.
