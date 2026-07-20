# Build 042 Admin Test Login

Create or reset the local/test administrator with:

```powershell
$env:DATABASE_URL="your PostgreSQL connection string"
$env:NEXUS_ADMIN_EMAIL="your test administrator email"
$env:NEXUS_ADMIN_PASSWORD="your unique test password"
npm run admin:create-test
```

The email and password environment variables are required. The account is created only when this command is run explicitly; production deploys do not create or reset test users.

Start the app with:

```powershell
npx netlify dev --dir dist
```

Open `http://localhost:8888/livecare.html`, choose **Dispatch sign in**, and enter the administrator credentials. An ADMIN account is accepted by the dispatch sign-in workflow. Then open `http://localhost:8888/admin.html` to test administrator permissions.

Use credentials created specifically for local or test environments. Reset or disable the test account when permission testing is complete.
