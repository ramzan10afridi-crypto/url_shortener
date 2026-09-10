// Very small in-process cache — same IP within the last hour reuses the result
// instead of hitting the free geo API again.
const cache = new Map<string, { country: string | null; expires: number }>();
const TTL_MS = 60 * 60 * 1000;

function isPrivateOrLoopback(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('::ffff:127.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

// Fetches ISO country code from ipapi.co. Returns null on any failure, or for
// local/private IPs where geo lookup is meaningless (e.g. during local dev).
export async function lookupCountry(rawIp: string): Promise<string | null> {
  const ip = rawIp.replace(/^::ffff:/, '');
  if (isPrivateOrLoopback(ip)) return null;

  const hit = cache.get(ip);
  if (hit && hit.expires > Date.now()) return hit.country;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'url-shortener/0.1' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      cache.set(ip, { country: null, expires: Date.now() + TTL_MS });
      return null;
    }
    const text = (await res.text()).trim();
    // ipapi.co returns a 2-letter code on success, or an error string / JSON blob otherwise.
    const country = /^[A-Z]{2}$/.test(text) ? text : null;
    cache.set(ip, { country, expires: Date.now() + TTL_MS });
    return country;
  } catch {
    return null;
  }
}
