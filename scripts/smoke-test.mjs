import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port = 4289;
const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', ADMIN_KEY: 'smoke-admin-key' };
const child = spawn(process.execPath, ['server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await sleep(150);
  }
  throw new Error(`Server did not start. ${stderr}`);
}

try {
  await waitForServer();
  const suffix = Date.now();
  const phone = `301555${String(suffix).slice(-4)}`;
  const bookingResponse = await fetch(`http://127.0.0.1:${port}/api/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Test Patient', phone, email: 'smoke@example.com',
      service: 'Wheelchair Transportation', pickup: '1 Main St, Rockville, MD',
      destination: 'Holy Cross Germantown Hospital', date: '2026-08-01', time: '09:00', notes: 'Automated smoke test'
    })
  });
  if (!bookingResponse.ok) throw new Error(`Booking failed: ${await bookingResponse.text()}`);
  const { booking } = await bookingResponse.json();

  const lookup = await fetch(`http://127.0.0.1:${port}/api/bookings/${encodeURIComponent(booking.reference)}?phone=${encodeURIComponent(phone)}`);
  if (!lookup.ok) throw new Error(`Lookup failed: ${await lookup.text()}`);

  const update = await fetch(`http://127.0.0.1:${port}/api/admin/bookings/${encodeURIComponent(booking.reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-key': 'smoke-admin-key' },
    body: JSON.stringify({ status: 'CONFIRMED', driverName: 'Test Driver', vehicleUnit: 'NMT-101' })
  });
  if (!update.ok) throw new Error(`Admin update failed: ${await update.text()}`);

  console.log(`Smoke test passed: ${booking.reference}`);
} finally {
  child.kill('SIGTERM');
}
