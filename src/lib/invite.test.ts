import { describe, expect, it } from 'vitest';
import { inviteLink, keyFromInvite } from './invite';

const KEY = 'sk-ant-api03-abcDEF_123-xyz';

describe('invite links', () => {
  it('reads the key from /join/<key>', () => {
    expect(keyFromInvite(`/join/${KEY}`)).toBe(KEY);
    expect(keyFromInvite(`/join/${KEY}/`)).toBe(KEY);
  });

  it('turns down anything that is not an Anthropic key', () => {
    expect(keyFromInvite('/join/')).toBeNull();
    expect(keyFromInvite('/join/hello-there-friend-123456')).toBeNull();
    expect(keyFromInvite('/join/sk-ant-short')).toBeNull();
    expect(keyFromInvite(`/join/${KEY}!`)).toBeNull();
    expect(keyFromInvite(`/join/${KEY}%20x`)).toBeNull();
    expect(keyFromInvite('/join/sk-ant-' + 'a'.repeat(294))).toBeNull();
    expect(keyFromInvite('/join/sk-ant-' + 'a'.repeat(293))).toHaveLength(300);
    expect(keyFromInvite(`/settings/${KEY}`)).toBeNull();
    expect(keyFromInvite(`/join/${KEY}/more`)).toBeNull();
    expect(keyFromInvite('/join/%E0%A4%A')).toBeNull();
  });

  it('builds a link that reads back to the same key', () => {
    const link = inviteLink(KEY, 'https://example.org/party-games/');
    expect(link).toBe(`https://example.org/party-games/#/join/${KEY}`);
    expect(keyFromInvite(link.split('#')[1])).toBe(KEY);
  });
});
