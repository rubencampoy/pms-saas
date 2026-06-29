/**
 * Public-IP matching utilities for the per-property access allowlist.
 *
 * Supports exact IPv4/IPv6 and CIDR ranges. IPv4-mapped IPv6 addresses
 * (e.g. `::ffff:1.2.3.4`) and IPv6 zone ids are normalized away so that a
 * proxy reporting either form still matches a plain IPv4 rule.
 *
 * Pure functions only — safe to import from server actions, RSC, or tests.
 */

/** Normalize a raw IP: strip zone id, brackets, and IPv4-mapped IPv6 prefix. */
export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  ip = ip.replace(/^\[|\]$/g, '');
  const pct = ip.indexOf('%');
  if (pct !== -1) ip = ip.slice(0, pct);
  if (ip.startsWith('::ffff:')) {
    const rest = ip.slice(7);
    if (rest.includes('.')) ip = rest;
  }
  return ip;
}

function isIpv4(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

function ipv6ToBigInt(ip: string): bigint | null {
  // At most one "::" compression marker is allowed.
  if (ip.indexOf('::') !== ip.lastIndexOf('::')) return null;

  let head: string[];
  let tail: string[] = [];
  if (ip.includes('::')) {
    const [h, t] = ip.split('::');
    head = h ? h.split(':') : [];
    tail = t ? t.split(':') : [];
  } else {
    head = ip.split(':');
  }

  // Expand a trailing embedded IPv4 group (e.g. ::ffff:1.2.3.4) into two hextets.
  const expand = (groups: string[]): string[] | null => {
    const out: string[] = [];
    for (const g of groups) {
      if (g.includes('.')) {
        const v4 = ipv4ToInt(g);
        if (v4 === null) return null;
        out.push(((v4 >>> 16) & 0xffff).toString(16));
        out.push((v4 & 0xffff).toString(16));
      } else {
        out.push(g);
      }
    }
    return out;
  };

  const h2 = expand(head);
  const t2 = expand(tail);
  if (!h2 || !t2) return null;

  const missing = 8 - (h2.length + t2.length);
  if (missing < 0) return null;
  if (!ip.includes('::') && missing !== 0) return null;

  const groups = [...h2, ...Array<string>(Math.max(missing, 0)).fill('0'), ...t2];
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    result = (result << 16n) | BigInt(parseInt(g, 16));
  }
  return result;
}

function matchRule(ip: string, ruleRaw: string): boolean {
  const rule = normalizeIp(ruleRaw);

  if (rule.includes('/')) {
    const [base, prefixStr] = rule.split('/');
    const prefix = Number(prefixStr);
    if (!base || !Number.isInteger(prefix)) return false;

    if (isIpv4(ip) && isIpv4(base)) {
      if (prefix < 0 || prefix > 32) return false;
      const a = ipv4ToInt(ip);
      const b = ipv4ToInt(base);
      if (a === null || b === null) return false;
      if (prefix === 0) return true;
      const mask = prefix === 32 ? 0xffffffff : (~((1 << (32 - prefix)) - 1)) >>> 0;
      return (a & mask) >>> 0 === (b & mask) >>> 0;
    }

    const a = ipv6ToBigInt(ip);
    const b = ipv6ToBigInt(base);
    if (a === null || b === null) return false;
    if (prefix < 0 || prefix > 128) return false;
    if (prefix === 0) return true;
    const mask = ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
    return (a & mask) === (b & mask);
  }

  if (isIpv4(ip) && isIpv4(rule)) {
    return ipv4ToInt(ip) === ipv4ToInt(rule);
  }
  const a = ipv6ToBigInt(ip);
  const b = ipv6ToBigInt(rule);
  if (a !== null && b !== null) return a === b;
  return ip === rule;
}

/** True if `rawIp` matches any rule (exact or CIDR) in `rules`. */
export function isIpAllowed(rawIp: string | null | undefined, rules: string[]): boolean {
  if (!rawIp) return false;
  const ip = normalizeIp(rawIp);
  return rules.some((rule) => matchRule(ip, rule));
}

/** Validate a user-entered allowlist entry (exact IPv4/IPv6 or CIDR). */
export function isValidIpOrCidr(value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  let base = v;
  let prefix: number | null = null;
  if (v.includes('/')) {
    const [b, p] = v.split('/');
    if (!b || p === undefined) return false;
    base = b;
    const pn = Number(p);
    if (!Number.isInteger(pn)) return false;
    prefix = pn;
  }

  const norm = normalizeIp(base);
  if (isIpv4(norm)) {
    if (ipv4ToInt(norm) === null) return false;
    return prefix === null || (prefix >= 0 && prefix <= 32);
  }
  if (ipv6ToBigInt(norm) !== null) {
    return prefix === null || (prefix >= 0 && prefix <= 128);
  }
  return false;
}
