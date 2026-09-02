const crypto = require('crypto');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Continuous deployment from GitHub.
 *
 * A push to main calls the webhook, which pulls, reinstalls, rebuilds and
 * restarts the app. Because this endpoint can run commands on the server, the
 * security properties matter more than the convenience:
 *
 *  - Every request must carry a valid HMAC signature from GitHub. Without a
 *    configured secret the endpoint refuses everything rather than running
 *    unauthenticated.
 *  - Signatures are compared in constant time.
 *  - The command sequence is fixed. Nothing from the request body reaches a
 *    shell, so a crafted payload cannot run arbitrary commands.
 *  - Only pushes to the main branch act; everything else is acknowledged and
 *    ignored.
 *  - One deploy at a time, guarded by a lock.
 */

const APP_DIR = path.resolve(__dirname, '../..');
const LOG_FILE = path.join(APP_DIR, 'deploy.log');
// Touching this file is how Phusion Passenger is asked to restart an app.
const RESTART_FILE = path.join(APP_DIR, 'server', 'tmp', 'restart.txt');

let deploying = false;

const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}\n`;
  process.stdout.write(stamped);
  try {
    fs.appendFileSync(LOG_FILE, stamped);
  } catch (err) {
    // Logging must never take the deploy down.
  }
};

/**
 * Verifies GitHub's X-Hub-Signature-256 over the raw request body.
 *
 * @param {Buffer} rawBody
 * @param {string} signature  Value of the X-Hub-Signature-256 header.
 * @returns {boolean}
 */
const verifySignature = (rawBody, signature) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // No secret means no authentication is possible, so nothing is accepted.
  if (!secret || !signature || !Buffer.isBuffer(rawBody)) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));

  // timingSafeEqual throws on length mismatch, so check that first.
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};

/**
 * Runs one command with fixed arguments. No shell, so nothing is interpolated.
 */
const run = (cmd, args, cwd) => new Promise((resolve, reject) => {
  execFile(cmd, args, { cwd, timeout: 10 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    const tail = (stdout || stderr || '').trim().split('\n').slice(-3).join(' | ');
    if (err) {
      log(`FAILED  ${cmd} ${args.join(' ')} -> ${err.message} ${tail}`);
      reject(err);
      return;
    }
    log(`ok      ${cmd} ${args.join(' ')} ${tail ? '-> ' + tail : ''}`);
    resolve(stdout);
  });
});

/**
 * Pull, install, build, restart. Runs in the background: the webhook has
 * already been answered by the time this finishes, because GitHub times out
 * long before a full build completes.
 */
const runDeploy = async () => {
  if (deploying) {
    log('SKIPPED - a deploy is already running');
    return;
  }

  deploying = true;
  log('deploy started');

  try {
    await run('git', ['fetch', '--all'], APP_DIR);
    await run('git', ['reset', '--hard', 'origin/main'], APP_DIR);
    const npm = 'win32' === process.platform ? 'npm.cmd' : 'npm';

    // Dependency installation is best-effort, not a gate. CloudLinux's Node
    // selector owns server/node_modules as a symlink into a virtualenv and
    // refuses an install that would shadow it, which would otherwise abort
    // every deploy. Dependencies change rarely; a code change should still
    // ship. When package.json does change, run npm install by hand.
    try {
      await run(npm, ['install', '--no-audit', '--no-fund'], APP_DIR);
    } catch (err) {
      log('npm install skipped - continuing with the dependencies already present');
    }

    await run(npm, ['run', 'build'], APP_DIR);

    // Restart last, so a failed build leaves the previous version serving.
    fs.mkdirSync(path.dirname(RESTART_FILE), { recursive: true });
    fs.writeFileSync(RESTART_FILE, new Date().toISOString());
    log('deploy finished - restart requested');
  } catch (err) {
    log(`deploy aborted: ${err.message} - the previous version is still serving`);
  } finally {
    deploying = false;
  }
};

/**
 * Express handler. Mount with express.raw() so the HMAC is computed over the
 * exact bytes GitHub signed.
 */
const handleWebhook = (req, res, deployFn = runDeploy) => {
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    log('rejected - GITHUB_WEBHOOK_SECRET is not configured');
    return res.status(503).send({ error: 'Deployment webhook is not configured' });
  }

  if (!verifySignature(req.body, req.get('X-Hub-Signature-256'))) {
    log(`rejected - bad signature from ${req.ip}`);
    return res.status(401).send({ error: 'Invalid signature' });
  }

  const event = req.get('X-GitHub-Event');

  if ('ping' === event) {
    return res.send({ ok: true, message: 'Webhook reachable' });
  }

  if ('push' !== event) {
    return res.send({ ok: true, ignored: `event ${event}` });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).send({ error: 'Malformed payload' });
  }

  if ('refs/heads/main' !== payload.ref) {
    return res.send({ ok: true, ignored: `branch ${payload.ref}` });
  }

  // Answer immediately - the build takes minutes and GitHub times out in ten
  // seconds. The deploy continues in the background.
  res.send({ ok: true, deploying: true, commit: (payload.after || '').slice(0, 7) });

  deployFn();
};

module.exports = { handleWebhook, verifySignature, runDeploy, LOG_FILE };
