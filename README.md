# ISC DHCP to Kea DHCP Migration Tool

A TypeScript/Bun-based tool for migrating ISC DHCP static mappings to Kea DHCP reservations in OPNsense configurations.

## Features

- Dry-run mode for previewing changes
- Verbose mode for debugging
- Compile to standalone executable

## Installation

```bash
bun install
```

## Usage

### Basic Usage

```bash
bun run src/index.ts <input.xml> [output.xml]
```

### Examples

```bash
# Migrate config.xml to new_config.xml (default output name)
bun run src/index.ts config.xml

# Specify custom output file
bun run src/index.ts config.xml migrated.xml

# Dry-run to preview changes without writing
bun run src/index.ts config.xml --dry-run

# Verbose output for detailed progress
bun run src/index.ts config.xml --verbose

# Combine options
bun run src/index.ts config.xml output.xml --dry-run --verbose
```

### Command-Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--dry-run` | `-d` | Preview changes without writing output file |
| `--verbose` | `-v` | Show detailed migration progress and subnet information |
| `--help` | `-h` | Show help message |

## How It Works

The migration process follows these steps:

1. **Parse XML Configuration**
   - Reads the input XML file
   - Validates XML structure
   - Extracts ISC DHCP static mappings from `<dhcpd>` section
   - Extracts Kea subnet definitions from `<Kea>` section

2. **Subnet Matching**
   - Builds CIDR range objects for each Kea subnet
   - Uses precise IP address matching via bitwise operations
   - Supports both CIDR notation (e.g., `/24`) and dotted netmask (e.g., `255.255.255.0`)

3. **Create Reservations**
   - Generates unique UUIDs for each reservation
   - Maps static IPs to appropriate subnets
   - Preserves hostname and description metadata
   - Validates MAC address formats

4. **Generate Output**
   - Injects reservations into XML structure
   - Preserves original XML formatting
   - Writes to output file (or displays preview in dry-run mode)

## Input Format

The tool expects OPNsense XML configuration with:

### ISC DHCP Static Mappings

```xml
<opnsense>
  <dhcpd>
    <lan>
      <staticmap>
        <mac>00:11:22:33:44:55</mac>
        <ipaddr>192.168.1.100</ipaddr>
        <hostname>myserver</hostname>
        <descr>Web Server</descr>
      </staticmap>
    </lan>
  </dhcpd>
</opnsense>
```

### Kea DHCP Subnets

```xml
<opnsense>
  <OPNsense>
    <Kea>
      <dhcp4>
        <subnets>
          <subnet4 uuid="abc-123-def-456">
            <subnet>192.168.1.0/24</subnet>
          </subnet4>
        </subnets>
      </dhcp4>
    </Kea>
  </OPNsense>
</opnsense>
```

## Output Format

The tool generates Kea reservations:

```xml
<opnsense>
  <OPNsense>
    <Kea>
      <dhcp4>
        <reservations>
          <reservation>
            <uuid>generated-uuid-here</uuid>
            <subnet>abc-123-def-456</subnet>
            <hw_address>00:11:22:33:44:55</hw_address>
            <ip_address>192.168.1.100</ip_address>
            <hostname>myserver</hostname>
            <description>Web Server</description>
          </reservation>
        </reservations>
      </dhcp4>
    </Kea>
  </OPNsense>
</opnsense>
```

## Migration Report

The tool generates a detailed report showing:

- Total static mappings processed
- Number of subnets configured
- Successfully created reservations
- Failed migrations with reasons
- Unmatched IPs (no subnet found)
- Warnings and errors

Example output:

```
============================================================
MIGRATION REPORT
============================================================

Statistics:
  • Total ISC static mappings: 10
  • Total Kea subnets: 2
  • Successful migrations: 9
  • Failed migrations: 1
  • Unmatched IPs: 1
  • Warnings: 1
  • Errors: 0

Created Reservations:
  1. 192.168.1.100 (00:11:22:33:44:55) - webserver → Subnet: 192.168.1.0/24
  2. 192.168.1.101 (00:11:22:33:44:56) - dbserver → Subnet: 192.168.1.0/24
  ...

Unmatched IPs (no subnet found):
  • 10.0.0.50

============================================================
```

## Building Standalone Executable

Compile to a single executable that doesn't require Bun to be installed:

```bash
bun run build
```

This creates an `isc-to-kea` executable that can be used directly:

```bash
./isc-to-kea config.xml output.xml
```

## Development

### Running Tests

```bash
bun test
```

### Project Structure

```
├── src/
│   ├── index.ts      # CLI entry point
│   ├── types.ts      # TypeScript type definitions
│   ├── parser.ts     # XML parsing and building
│   ├── cidr.ts       # CIDR subnet matching logic
│   └── migrator.ts   # Core migration logic
├── test/
│   ├── fixtures/     # Sample XML files for testing
│   └── *.test.ts     # Unit tests
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### macOS: Binary is damaged

**Issue**: "isc-to-kea is damaged and can't be opened"

**Solution**: Remove quarantine attribute from downloaded binary:
```bash
xattr -d com.apple.quarantine isc-to-kea-darwin-arm64
chmod +x isc-to-kea-darwin-arm64
```

### No subnets found

**Issue**: "No <Kea> section found in XML"

**Solution**: Ensure your configuration file has Kea subnets defined. The tool needs both ISC static mappings AND Kea subnets to perform the migration.

### Unmatched IPs

**Issue**: IPs shown in "Unmatched IPs" section

**Solution**: These IPs don't fall within any configured Kea subnet. Either:
1. Add the appropriate subnet to your Kea configuration
2. Correct the IP address in the static mapping

### Invalid MAC address

**Issue**: "Invalid MAC address format"

**Solution**: MAC addresses must be in one of these formats:
- `00:11:22:33:44:55` (colon-separated)
- `00-11-22-33-44-55` (dash-separated)
- `001122334455` (no separators)

## License

MIT

## Credits

Inspired by the original Java-based migration tool from the [Migration repository](https://github.com/EasyG0ing1/Migration).
