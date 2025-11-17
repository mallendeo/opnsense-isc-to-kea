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

## Build Standalone Binary

```bash
bun run build
```

## Development

```bash
bun test
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
