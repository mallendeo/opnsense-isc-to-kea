export interface StaticMapping {
  mac: string;
  ipaddr: string;
  hostname?: string;
  description?: string;
  cid?: string;
  descr?: string;
}

export interface Subnet {
  uuid: string;
  subnet: string;
  netmask: string;
}

export interface Reservation {
  uuid: string;
  subnet: string;
  hw_address: string;
  ip_address: string;
  hostname?: string;
  description?: string;
}

export interface MigrationResult {
  reservations: Reservation[];
  reservationsCreated: number;
  unmatchedIPs: string[];
  warnings: string[];
  errors: string[];
}

export interface MigrationConfig {
  inputFile: string;
  outputFile: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface MigrationStats {
  totalStaticMappings: number;
  totalSubnets: number;
  successfulMigrations: number;
  failedMigrations: number;
  unmatchedIPs: number;
  warnings: number;
  errors: number;
}
