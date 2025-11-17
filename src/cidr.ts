import { IPv4, IPv4CidrRange } from 'ip-num';
import type { Subnet } from './types';

export class SubnetMatcher {
  private subnets: Map<string, IPv4CidrRange> = new Map();
  private subnetMetadata: Map<string, Subnet> = new Map();

  constructor(subnets: Subnet[]) {
    this.buildSubnetMap(subnets);
  }

  private buildSubnetMap(subnets: Subnet[]): void {
    for (const subnet of subnets) {
      try {
        const cidr = this.buildCIDR(subnet.subnet, subnet.netmask);
        if (cidr) {
          this.subnets.set(subnet.uuid, cidr);
          this.subnetMetadata.set(subnet.uuid, subnet);
        } else {
          console.warn(`WARNING: Failed to parse subnet: ${subnet.subnet}/${subnet.netmask}`);
        }
      } catch (error) {
        console.warn(`WARNING: Error parsing subnet ${subnet.subnet}/${subnet.netmask}:`, error);
      }
    }
  }

  private buildCIDR(subnet: string, netmask: string): IPv4CidrRange | null {
    try {
      new IPv4(subnet);

      if (/^\d+$/.test(netmask)) {
        const prefix = parseInt(netmask, 10);
        if (prefix < 0 || prefix > 32) {
          console.warn(`Invalid CIDR prefix: ${prefix} (must be 0-32)`);
          return null;
        }
        return IPv4CidrRange.fromCidr(`${subnet}/${prefix}`);
      }

      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(netmask)) {
        const prefixLength = this.netmaskToCIDR(netmask);
        if (prefixLength === null) {
          console.warn(`Invalid netmask: ${netmask}`);
          return null;
        }
        return IPv4CidrRange.fromCidr(`${subnet}/${prefixLength}`);
      }

      console.warn(`Invalid netmask format: ${netmask}`);
      return null;
    } catch (error) {
      console.warn(`Invalid subnet: ${subnet}/${netmask}`, error);
      return null;
    }
  }

  private netmaskToCIDR(netmask: string): number | null {
    try {
      const octets = netmask.split('.').map(Number);

      if (octets.length !== 4) return null;
      if (octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
        return null;
      }

      const binary = octets.map(octet => octet.toString(2).padStart(8, '0')).join('');
      const ones = binary.match(/^1*/)?.[0].length || 0;
      const expectedBinary = '1'.repeat(ones) + '0'.repeat(32 - ones);
      if (binary !== expectedBinary) {
        console.warn(`Invalid netmask (not contiguous): ${netmask}`);
        return null;
      }

      return ones;
    } catch (error) {
      console.warn(`Error converting netmask to CIDR: ${netmask}`, error);
      return null;
    }
  }

  public findSubnetForIP(ipAddress: string): string | null {
    try {
      const ip = new IPv4(ipAddress);

      for (const [uuid, cidrRange] of this.subnets.entries()) {
        if (cidrRange.contains(ip)) {
          return uuid;
        }
      }

      return null;
    } catch (error) {
      console.warn(`Invalid IP address: ${ipAddress}`, error);
      return null;
    }
  }

  public getSubnetInfo(uuid: string): Subnet | null {
    return this.subnetMetadata.get(uuid) || null;
  }

  public getAllSubnets(): Subnet[] {
    return Array.from(this.subnetMetadata.values());
  }

  public getCIDRRange(uuid: string): IPv4CidrRange | null {
    return this.subnets.get(uuid) || null;
  }

  public static isValidIP(ipAddress: string): boolean {
    try {
      new IPv4(ipAddress);
      return true;
    } catch {
      return false;
    }
  }

  public getSubnetSummary(): string[] {
    const summary: string[] = [];
    for (const [uuid, cidr] of this.subnets.entries()) {
      const metadata = this.subnetMetadata.get(uuid);
      const first = cidr.getFirst().toString();
      const last = cidr.getLast().toString();
      const size = cidr.getSize();
      summary.push(
        `UUID: ${uuid}\n` +
        `  Range: ${metadata?.subnet}/${metadata?.netmask}\n` +
        `  First IP: ${first}\n` +
        `  Last IP: ${last}\n` +
        `  Size: ${size} addresses`
      );
    }
    return summary;
  }
}
