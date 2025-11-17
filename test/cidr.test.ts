import { describe, test, expect } from 'bun:test';
import { SubnetMatcher } from '../src/cidr';
import type { Subnet } from '../src/types';

describe('SubnetMatcher', () => {
  test('should match IP to correct subnet with CIDR prefix', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.1.0', netmask: '24' },
      { uuid: 'uuid-2', subnet: '10.0.0.0', netmask: '8' },
    ];

    const matcher = new SubnetMatcher(subnets);

    expect(matcher.findSubnetForIP('192.168.1.50')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('192.168.1.1')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('192.168.1.254')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('10.5.10.20')).toBe('uuid-2');
    expect(matcher.findSubnetForIP('10.255.255.255')).toBe('uuid-2');
  });

  test('should return null for unmatched IPs', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.1.0', netmask: '24' },
    ];

    const matcher = new SubnetMatcher(subnets);

    expect(matcher.findSubnetForIP('172.16.0.1')).toBeNull();
    expect(matcher.findSubnetForIP('192.168.2.1')).toBeNull();
  });

  test('should handle dotted decimal netmask notation', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.1.0', netmask: '255.255.255.0' },
      { uuid: 'uuid-2', subnet: '10.0.0.0', netmask: '255.0.0.0' },
    ];

    const matcher = new SubnetMatcher(subnets);

    expect(matcher.findSubnetForIP('192.168.1.100')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('192.168.2.100')).toBeNull();
    expect(matcher.findSubnetForIP('10.5.10.20')).toBe('uuid-2');
  });

  test('should validate IP addresses', () => {
    expect(SubnetMatcher.isValidIP('192.168.1.1')).toBe(true);
    expect(SubnetMatcher.isValidIP('10.0.0.1')).toBe(true);
    expect(SubnetMatcher.isValidIP('255.255.255.255')).toBe(true);
    expect(SubnetMatcher.isValidIP('0.0.0.0')).toBe(true);

    expect(SubnetMatcher.isValidIP('256.1.1.1')).toBe(false);
    expect(SubnetMatcher.isValidIP('192.168.1')).toBe(false);
    expect(SubnetMatcher.isValidIP('not-an-ip')).toBe(false);
    expect(SubnetMatcher.isValidIP('')).toBe(false);
  });

  test('should handle /32 subnet (single host)', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.1.100', netmask: '32' },
    ];

    const matcher = new SubnetMatcher(subnets);

    expect(matcher.findSubnetForIP('192.168.1.100')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('192.168.1.101')).toBeNull();
  });

  test('should handle /16 subnet', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.0.0', netmask: '16' },
    ];

    const matcher = new SubnetMatcher(subnets);

    expect(matcher.findSubnetForIP('192.168.1.1')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('192.168.255.255')).toBe('uuid-1');
    expect(matcher.findSubnetForIP('192.169.1.1')).toBeNull();
  });

  test('should get subnet info', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.1.0', netmask: '24' },
    ];

    const matcher = new SubnetMatcher(subnets);
    const info = matcher.getSubnetInfo('uuid-1');

    expect(info).not.toBeNull();
    expect(info?.subnet).toBe('192.168.1.0');
    expect(info?.netmask).toBe('24');
  });

  test('should get all subnets', () => {
    const subnets: Subnet[] = [
      { uuid: 'uuid-1', subnet: '192.168.1.0', netmask: '24' },
      { uuid: 'uuid-2', subnet: '10.0.0.0', netmask: '8' },
    ];

    const matcher = new SubnetMatcher(subnets);
    const allSubnets = matcher.getAllSubnets();

    expect(allSubnets).toHaveLength(2);
    expect(allSubnets[0].uuid).toBe('uuid-1');
    expect(allSubnets[1].uuid).toBe('uuid-2');
  });
});
