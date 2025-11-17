#!/usr/bin/env bun

import { ConfigParser } from './parser';
import { DHCPMigrator } from './migrator';
import type { MigrationConfig } from './types';

function printUsage(): void {
  console.log(`
===============================================================
          ISC DHCP to Kea DHCP Migration Tool
===============================================================

Usage: bun run src/index.ts <input.xml> [output.xml] [options]

Arguments:
  input.xml       Input XML configuration file (required)
  output.xml      Output XML configuration file (default: new_config.xml)

Options:
  -d, --dry-run   Preview changes without writing output file
  -v, --verbose   Show detailed migration progress
  -h, --help      Show this help message

Examples:
  bun run src/index.ts config.xml
  bun run src/index.ts config.xml output.xml --verbose
  bun run src/index.ts config.xml --dry-run

Description:
  This tool migrates ISC DHCP static mappings to Kea DHCP reservations.
  It reads an OPNsense XML configuration file, extracts ISC DHCP static
  IP mappings, matches them to Kea subnets using CIDR calculations, and
  creates Kea reservation entries.
`);
}

function parseArgs(): MigrationConfig | null {
  const args = Bun.argv.slice(2); // Skip 'bun' and script name

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
    return null;
  }

  const config: MigrationConfig = {
    inputFile: '',
    outputFile: 'new_config.xml',
    dryRun: false,
    verbose: false,
  };

  const nonFlagArgs: string[] = [];

  for (const arg of args) {
    if (arg === '-d' || arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '-v' || arg === '--verbose') {
      config.verbose = true;
    } else if (!arg.startsWith('-')) {
      nonFlagArgs.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      return null;
    }
  }

  if (nonFlagArgs.length < 1) {
    console.error('Error: Input file is required');
    printUsage();
    return null;
  }

  config.inputFile = nonFlagArgs[0];
  if (nonFlagArgs.length > 1) {
    config.outputFile = nonFlagArgs[1];
  }

  return config;
}

async function main(): Promise<void> {
  const config = parseArgs();
  if (!config) {
    process.exit(1);
  }

  console.log('===============================================================');
  console.log('          ISC DHCP to Kea DHCP Migration Tool');
  console.log('===============================================================\n');

  try {
    console.log(`Reading input file: ${config.inputFile}...`);
    const inputFile = Bun.file(config.inputFile);

    if (!(await inputFile.exists())) {
      console.error(`Error: File not found: ${config.inputFile}`);
      process.exit(1);
    }

    const xmlContent = await inputFile.text();

    if (!xmlContent || xmlContent.trim().length === 0) {
      console.error('Error: Input file is empty');
      process.exit(1);
    }

    console.log('Validating XML...');
    const parser = new ConfigParser();
    const validation = parser.validateXML(xmlContent);

    if (!validation.valid) {
      console.error(`Error: Invalid XML: ${validation.error}`);
      process.exit(1);
    }

    console.log('XML validation passed\n');

    console.log('Parsing configuration...');
    const { staticMappings, subnets } = parser.parseConfig(xmlContent);

    console.log(`  • Found ${staticMappings.length} ISC DHCP static mappings`);
    console.log(`  • Found ${subnets.length} Kea DHCP subnets\n`);

    const migrator = new DHCPMigrator(subnets, config.verbose);

    if (config.verbose) {
      migrator.printSubnetSummary();
    }

    console.log('Validating migration...');
    const validation2 = migrator.validateMigration(staticMappings);

    if (!validation2.valid) {
      console.error('Migration validation failed:');
      validation2.issues.forEach(issue => {
        console.error(`   • ${issue}`);
      });
      process.exit(1);
    }

    console.log('Migration validation passed\n');

    console.log('Migrating ISC DHCP to Kea DHCP...\n');
    const result = migrator.migrate(staticMappings);

    const report = migrator.generateReport(staticMappings, result);
    console.log(report);

    if (result.reservationsCreated === 0) {
      console.error('No reservations were created. Migration failed.');
      process.exit(1);
    }

    if (config.dryRun) {
      console.log('DRY RUN MODE - No files were modified\n');
      console.log('Run without --dry-run to write changes to output file.');
    } else {
      console.log(`Writing output to: ${config.outputFile}...`);

      const outputXML = parser.injectReservations(xmlContent, result.reservations);
      await Bun.write(config.outputFile, outputXML);

      console.log(`Successfully wrote ${result.reservationsCreated} reservations to ${config.outputFile}\n`);
    }

    console.log('Migration complete!');

    if (result.warnings.length > 0 || result.errors.length > 0) {
      console.log('\nPlease review warnings and errors above.');
      if (result.unmatchedIPs.length > 0) {
        console.log(`   ${result.unmatchedIPs.length} IP(s) could not be matched to any subnet.`);
      }
    }

    const exitCode = result.errors.length > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('\nFatal error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
