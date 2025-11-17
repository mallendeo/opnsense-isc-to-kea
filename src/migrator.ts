import { randomUUID } from 'crypto';
import { SubnetMatcher } from './cidr';
import type {
  StaticMapping,
  Subnet,
  Reservation,
  MigrationResult,
  MigrationStats,
} from './types';

export class DHCPMigrator {
  private subnetMatcher: SubnetMatcher;
  private verbose: boolean;

  constructor(subnets: Subnet[], verbose: boolean = false) {
    this.subnetMatcher = new SubnetMatcher(subnets);
    this.verbose = verbose;
  }

  public migrate(staticMappings: StaticMapping[]): MigrationResult {
    const reservations: Reservation[] = [];
    const unmatchedIPs: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (this.verbose) {
      console.log(`\nProcessing ${staticMappings.length} static mappings...`);
    }

    for (let i = 0; i < staticMappings.length; i++) {
      const mapping = staticMappings[i];

      if (!mapping.mac || !mapping.ipaddr) {
        const warning = `Skipping mapping #${i + 1}: Missing required fields (mac: ${mapping.mac}, ip: ${mapping.ipaddr})`;
        warnings.push(warning);
        if (this.verbose) {
          console.log(`WARNING: ${warning}`);
        }
        continue;
      }

      if (!this.isValidMAC(mapping.mac)) {
        const warning = `Invalid MAC address format: ${mapping.mac} (IP: ${mapping.ipaddr})`;
        warnings.push(warning);
        if (this.verbose) {
          console.log(`WARNING: ${warning}`);
        }
        continue;
      }

      if (!SubnetMatcher.isValidIP(mapping.ipaddr)) {
        const error = `Invalid IP address: ${mapping.ipaddr} (MAC: ${mapping.mac})`;
        errors.push(error);
        if (this.verbose) {
          console.log(`ERROR: ${error}`);
        }
        continue;
      }

      const subnetUUID = this.subnetMatcher.findSubnetForIP(mapping.ipaddr);

      if (!subnetUUID) {
        unmatchedIPs.push(mapping.ipaddr);
        const warning = `No subnet found for IP: ${mapping.ipaddr} (MAC: ${mapping.mac}${mapping.hostname ? ', hostname: ' + mapping.hostname : ''})`;
        warnings.push(warning);
        if (this.verbose) {
          console.log(`WARNING: ${warning}`);
        }
        continue;
      }

      const reservation: Reservation = {
        uuid: randomUUID(),
        subnet: subnetUUID,
        hw_address: mapping.mac,
        ip_address: mapping.ipaddr,
      };

      if (mapping.hostname) {
        reservation.hostname = mapping.hostname;
      }
      if (mapping.description || mapping.descr) {
        reservation.description = mapping.description || mapping.descr;
      }

      reservations.push(reservation);

      if (this.verbose) {
        const subnetInfo = this.subnetMatcher.getSubnetInfo(subnetUUID);
        console.log(
          `Matched ${mapping.ipaddr} (${mapping.mac}) to subnet ${subnetInfo?.subnet}/${subnetInfo?.netmask}`
        );
      }
    }

    return {
      reservations,
      reservationsCreated: reservations.length,
      unmatchedIPs,
      warnings,
      errors,
    };
  }

  private isValidMAC(mac: string): boolean {
    const patterns = [
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
      /^[0-9A-Fa-f]{12}$/,
    ];

    return patterns.some(pattern => pattern.test(mac));
  }

  public getStats(
    staticMappings: StaticMapping[],
    result: MigrationResult
  ): MigrationStats {
    const subnets = this.subnetMatcher.getAllSubnets();

    return {
      totalStaticMappings: staticMappings.length,
      totalSubnets: subnets.length,
      successfulMigrations: result.reservationsCreated,
      failedMigrations: staticMappings.length - result.reservationsCreated,
      unmatchedIPs: result.unmatchedIPs.length,
      warnings: result.warnings.length,
      errors: result.errors.length,
    };
  }

  public printSubnetSummary(): void {
    const summaries = this.subnetMatcher.getSubnetSummary();

    if (summaries.length === 0) {
      console.log('WARNING: No subnets configured');
      return;
    }

    console.log(`\nConfigured Subnets (${summaries.length}):`);
    console.log('='.repeat(60));
    summaries.forEach((summary, index) => {
      console.log(`\nSubnet ${index + 1}:`);
      console.log(summary);
    });
    console.log('='.repeat(60));
  }

  public validateMigration(staticMappings: StaticMapping[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    const subnets = this.subnetMatcher.getAllSubnets();
    if (subnets.length === 0) {
      issues.push('No Kea subnets found in configuration');
    }

    if (staticMappings.length === 0) {
      issues.push('No ISC DHCP static mappings found in configuration');
    }

    let validMappings = 0;
    for (const mapping of staticMappings) {
      if (mapping.mac && mapping.ipaddr) {
        validMappings++;
      }
    }

    if (validMappings === 0 && staticMappings.length > 0) {
      issues.push('No valid static mappings found (missing MAC or IP addresses)');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  public generateReport(
    staticMappings: StaticMapping[],
    result: MigrationResult
  ): string {
    const stats = this.getStats(staticMappings, result);
    const subnets = this.subnetMatcher.getAllSubnets();

    let report = '\n';
    report += '='.repeat(60) + '\n';
    report += 'MIGRATION REPORT\n';
    report += '='.repeat(60) + '\n\n';

    report += 'Statistics:\n';
    report += `  • Total ISC static mappings: ${stats.totalStaticMappings}\n`;
    report += `  • Total Kea subnets: ${stats.totalSubnets}\n`;
    report += `  • Successful migrations: ${stats.successfulMigrations}\n`;
    report += `  • Failed migrations: ${stats.failedMigrations}\n`;
    report += `  • Unmatched IPs: ${stats.unmatchedIPs}\n`;
    report += `  • Warnings: ${stats.warnings}\n`;
    report += `  • Errors: ${stats.errors}\n\n`;

    if (result.reservations.length > 0) {
      report += 'Created Reservations:\n';
      result.reservations.forEach((r, i) => {
        const subnetInfo = this.subnetMatcher.getSubnetInfo(r.subnet);
        report += `  ${i + 1}. ${r.ip_address} (${r.hw_address})`;
        if (r.hostname) report += ` - ${r.hostname}`;
        report += ` → Subnet: ${subnetInfo?.subnet}/${subnetInfo?.netmask}\n`;
      });
      report += '\n';
    }

    if (result.unmatchedIPs.length > 0) {
      report += 'Unmatched IPs (no subnet found):\n';
      result.unmatchedIPs.forEach(ip => {
        report += `  • ${ip}\n`;
      });
      report += '\n';
    }

    if (result.warnings.length > 0) {
      report += 'Warnings:\n';
      result.warnings.forEach(warning => {
        report += `  • ${warning}\n`;
      });
      report += '\n';
    }

    if (result.errors.length > 0) {
      report += 'Errors:\n';
      result.errors.forEach(error => {
        report += `  • ${error}\n`;
      });
      report += '\n';
    }

    report += '='.repeat(60) + '\n';

    return report;
  }
}
