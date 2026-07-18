# Windows Stripe dependency fix

The server imports the official `stripe` Node package. A copied or older `node_modules` directory may exist without that package, which causes `ERR_MODULE_NOT_FOUND`.

## First start

From the project folder, run:

```bat
npm install
npm run build
npm start
```

Or double-click `start-windows.bat`. Version 1.0.7 checks specifically for `node_modules\stripe\package.json` and installs dependencies automatically when it is missing.

## Clean reinstall if needed

```bat
rmdir /s /q node_modules
del package-lock.json
npm install
npm run build
npm start
```

Do not put Stripe secret keys in frontend files. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the server environment.
