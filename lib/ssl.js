const fs = require('fs');
const path = require('path');
const tls = require('tls');

const envCa = process.env.AIVEN_CA_CERT?.trim();
const envCaPath = process.env.AIVEN_CA_PATH;
const caPath = envCaPath
  ? (path.isAbsolute(envCaPath) ? envCaPath : path.resolve(process.cwd(), envCaPath))
  : path.resolve(process.cwd(), 'aiven-ca.pem');

function loadAivenCa() {
  if (envCa) {
    return envCa;
  }

  try {
    if (fs.existsSync(caPath)) {
      return fs.readFileSync(caPath, 'utf8');
    }
  } catch (err) {
    console.error('SSL helper read error:', err.message);
  }

  return null;
}

function getAivenTlsOptions() {
  const ca = loadAivenCa();
  if (ca) {
    return {
      ca: [...tls.rootCertificates, ca],
      rejectUnauthorized: true
    };
  }
  return undefined;
}

module.exports = {
  getAivenTlsOptions,
  loadAivenCa
};
