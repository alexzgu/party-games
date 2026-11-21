import { describe, expect, it } from 'vitest';
import { buckets, clientOf } from './address';

describe('client addresses', () => {
  it('count IPv4 by the full address, in its /24 network', () => {
    expect(buckets('203.0.113.7')).toEqual({ address: 'v4 203.0.113.7', network: 'v4 203.0.113/24' });
    expect(buckets(' 203.0.113.7 ').address).toBe('v4 203.0.113.7');
  });
  it('count IPv6 by its /64, in its /48 network, however it is written', () => {
    const one = buckets('2001:db8:1:2::1');
    expect(one).toEqual({ address: 'v6 2001:db8:1:2::/64', network: 'v6 2001:db8:1::/48' });
    expect(buckets('2001:0DB8:0001:0002:ffff:eeee:dddd:cccc')).toEqual(one);
    expect(buckets('2001:db8:1:2:0:0:0:99%eth0')).toEqual(one);
    expect(buckets('2001:db8:1:3::1').address).not.toBe(one.address);
    expect(buckets('2001:db8:1:3::1').network).toBe(one.network);
    expect(buckets('::1').address).toBe('v6 0:0:0:0::/64');
    expect(buckets('2001:db8::').address).toBe('v6 2001:db8:0:0::/64');
    expect(buckets('64:ff9b:1:2::203.0.113.7').address).toBe('v6 64:ff9b:1:2::/64');
  });
  it('treat an IPv4-mapped IPv6 address as the IPv4 address', () => {
    expect(buckets('::ffff:203.0.113.7')).toEqual(buckets('203.0.113.7'));
    expect(buckets('::ffff:cb00:7107')).toEqual(buckets('203.0.113.7'));
  });
  it('put anything else in a bucket of its own text', () => {
    for (const bad of ['unknown', '256.1.1.1', '1.2.3', '1:2:3:4:5:6:7:8:9', '1::2::3', '12345::1', '1:2:3:4:5:6:7:8::']) {
      expect(buckets(bad)).toEqual({ address: `other ${bad}`, network: `other ${bad}` });
    }
  });
  it('store one-way labels, never the address', async () => {
    const c = await clientOf('203.0.113.7');
    expect(c.address).toMatch(/^[\w-]{16}$/);
    expect(c.address).not.toBe(c.network);
    expect(JSON.stringify(c)).not.toContain('203');
    expect(await clientOf('2001:db8:1:2::1')).toEqual(await clientOf('2001:db8:1:2::abcd'));
    expect(await clientOf(null)).toEqual(await clientOf('unknown'));
  });
});
