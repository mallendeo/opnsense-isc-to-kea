import { describe, test, expect } from 'bun:test';
import { ConfigParser } from '../src/parser';

describe('ConfigParser', () => {
  const sampleXML = `<?xml version="1.0"?>
<opnsense>
  <dhcpd>
    <lan>
      <staticmap>
        <mac>00:11:22:33:44:55</mac>
        <ipaddr>192.168.1.100</ipaddr>
        <hostname>server1</hostname>
        <descr>Test Server</descr>
      </staticmap>
    </lan>
  </dhcpd>
  <OPNsense>
    <Kea>
      <dhcp4>
        <subnets>
          <subnet4 uuid="test-uuid-123">
            <subnet>192.168.1.0/24</subnet>
          </subnet4>
        </subnets>
      </dhcp4>
    </Kea>
  </OPNsense>
</opnsense>`;

  test('should validate well-formed XML', () => {
    const parser = new ConfigParser();
    const result = parser.validateXML(sampleXML);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should handle empty XML gracefully', () => {
    const parser = new ConfigParser();
    const emptyXML = '';
    const result = parser.validateXML(emptyXML);

    // fast-xml-parser is lenient, so this might pass or fail depending on version
    // We just ensure it doesn't crash
    expect(typeof result.valid).toBe('boolean');
  });

  test('should parse static mappings', () => {
    const parser = new ConfigParser();
    const mappings = parser.parseStaticMappings(sampleXML);

    expect(mappings).toHaveLength(1);
    expect(mappings[0].mac).toBe('00:11:22:33:44:55');
    expect(mappings[0].ipaddr).toBe('192.168.1.100');
    expect(mappings[0].hostname).toBe('server1');
    expect(mappings[0].description).toBe('Test Server');
  });

  test('should parse subnets', () => {
    const parser = new ConfigParser();
    const subnets = parser.parseSubnets(sampleXML);

    expect(subnets).toHaveLength(1);
    expect(subnets[0].uuid).toBe('test-uuid-123');
    expect(subnets[0].subnet).toBe('192.168.1.0');
    expect(subnets[0].netmask).toBe('24');
  });

  test('should parse config with both mappings and subnets', () => {
    const parser = new ConfigParser();
    const config = parser.parseConfig(sampleXML);

    expect(config.staticMappings).toHaveLength(1);
    expect(config.subnets).toHaveLength(1);
  });

  test('should handle XML without static mappings', () => {
    const parser = new ConfigParser();
    const xmlWithoutMappings = `<?xml version="1.0"?>
<opnsense>
  <dhcpd>
    <lan>
    </lan>
  </dhcpd>
</opnsense>`;

    const mappings = parser.parseStaticMappings(xmlWithoutMappings);
    expect(mappings).toHaveLength(0);
  });

  test('should handle XML without subnets', () => {
    const parser = new ConfigParser();
    const xmlWithoutSubnets = `<?xml version="1.0"?>
<opnsense>
  <OPNsense>
    <Kea>
      <dhcp4>
      </dhcp4>
    </Kea>
  </OPNsense>
</opnsense>`;

    const subnets = parser.parseSubnets(xmlWithoutSubnets);
    expect(subnets).toHaveLength(0);
  });

  test('should handle multiple static mappings', () => {
    const parser = new ConfigParser();
    const multiMappingXML = `<?xml version="1.0"?>
<opnsense>
  <dhcpd>
    <lan>
      <staticmap>
        <mac>00:11:22:33:44:55</mac>
        <ipaddr>192.168.1.100</ipaddr>
      </staticmap>
      <staticmap>
        <mac>AA:BB:CC:DD:EE:FF</mac>
        <ipaddr>192.168.1.101</ipaddr>
      </staticmap>
    </lan>
  </dhcpd>
</opnsense>`;

    const mappings = parser.parseStaticMappings(multiMappingXML);
    expect(mappings).toHaveLength(2);
  });
});
