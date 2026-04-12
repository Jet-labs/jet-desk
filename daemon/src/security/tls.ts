import forge from 'node-forge';
import fs from 'fs';
import os from 'os';
import { CERT_FILE, KEY_FILE } from '../config/index.js';

export interface TlsCredentials {
  cert: string;
  key: string;
  fingerprint: string;
}

// ─── Generate or load self-signed TLS certificate ────────────────────────────

export function ensureTlsCertificate(): TlsCredentials {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    try {
      const cert = fs.readFileSync(CERT_FILE, 'utf-8');
      const key  = fs.readFileSync(KEY_FILE, 'utf-8');
      const fingerprint = computeFingerprint(cert);
      console.log('[TLS] Loaded existing certificate, fingerprint:', fingerprint);
      return { cert, key, fingerprint };
    } catch {
      console.warn('[TLS] Failed to load existing cert, regenerating...');
    }
  }
  return generateCertificate();
}

function generateCertificate(): TlsCredentials {
  console.log('[TLS] Generating self-signed certificate...');

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert  = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter  = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const hostname = os.hostname();
  const attrs = [
    { name: 'commonName',         value: `JetDesk-${hostname}` },
    { name: 'organizationName',   value: 'JetDesk' },
    { name: 'organizationalUnitName', value: 'Daemon' },
    { name: 'countryName',        value: 'US' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 2, value: hostname },
        { type: 7, ip: '127.0.0.1' },
        { type: 7, ip: getLocalIp() },
      ],
    },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem  = forge.pki.privateKeyToPem(keys.privateKey);

  fs.writeFileSync(CERT_FILE, certPem, { mode: 0o600 });
  fs.writeFileSync(KEY_FILE,  keyPem,  { mode: 0o600 });

  const fingerprint = computeFingerprint(certPem);
  console.log('[TLS] Certificate generated, fingerprint:', fingerprint);
  return { cert: certPem, key: keyPem, fingerprint };
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────

export function computeFingerprint(certPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const der  = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md   = forge.md.sha256.create();
  md.update(der);
  return md.digest().toHex().match(/.{2}/g)!.join(':').toUpperCase();
}

// ─── Local IP ─────────────────────────────────────────────────────────────────

export function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}