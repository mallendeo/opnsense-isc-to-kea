import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { StaticMapping, Subnet, Reservation } from './types';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
  parseTagValue: false,
};

const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true,
  suppressBooleanAttributes: false,
};

export class ConfigParser {
  private parser: XMLParser;
  private builder: XMLBuilder;

  constructor() {
    this.parser = new XMLParser(parserOptions);
    this.builder = new XMLBuilder(builderOptions);
  }

  public parseStaticMappings(xmlContent: string): StaticMapping[] {
    try {
      const jsonObj = this.parser.parse(xmlContent);

      const staticMaps: StaticMapping[] = [];

      const dhcpd = jsonObj?.opnsense?.dhcpd || jsonObj?.dhcpd;
      if (!dhcpd) {
        console.warn('WARNING: No <dhcpd> section found in XML');
        return [];
      }

      for (const interfaceName in dhcpd) {
        const iface = dhcpd[interfaceName];

        if (typeof iface !== 'object' || !iface.staticmap) {
          continue;
        }

        const maps = Array.isArray(iface.staticmap) ? iface.staticmap : [iface.staticmap];

        for (const map of maps) {
          if (map && typeof map === 'object') {
            staticMaps.push({
              mac: map.mac || '',
              ipaddr: map.ipaddr || '',
              hostname: map.hostname || undefined,
              description: map.descr || map.description || undefined,
              cid: map.cid || undefined,
            });
          }
        }
      }

      return staticMaps;
    } catch (error) {
      throw new Error(`Failed to parse static mappings: ${error}`);
    }
  }

  public parseSubnets(xmlContent: string): Subnet[] {
    try {
      const jsonObj = this.parser.parse(xmlContent);

      const subnets: Subnet[] = [];

      const root = jsonObj?.opnsense || jsonObj;
      const opnSense = root?.OPNsense || root?.opnsense || root;
      const kea = opnSense?.Kea || opnSense?.kea || opnSense?.KEA;

      if (!kea) {
        console.warn('WARNING: No <Kea> section found in XML');
        return [];
      }

      const dhcp4 = kea.dhcp4 || kea.Dhcp4 || kea.DHCP4;
      if (!dhcp4) {
        console.warn('WARNING: No <dhcp4> section found in Kea config');
        return [];
      }

      const subnetsSection = dhcp4.subnets || dhcp4.Subnets;
      if (!subnetsSection) {
        console.warn('WARNING: No <subnets> section found in dhcp4 config');
        return [];
      }

      const subnetArray = subnetsSection.subnet4
        ? Array.isArray(subnetsSection.subnet4) ? subnetsSection.subnet4 : [subnetsSection.subnet4]
        : [];

      for (const subnet of subnetArray) {
        if (subnet && typeof subnet === 'object' && subnet.subnet) {
          const uuid = subnet['@_uuid'] || subnet.uuid;

          if (!uuid) {
            console.warn(`WARNING: Subnet ${subnet.subnet} missing UUID`);
            continue;
          }

          const subnetStr = subnet.subnet.toString();
          const parts = subnetStr.split('/');

          if (parts.length === 2) {
            subnets.push({
              uuid: uuid.toString(),
              subnet: parts[0],
              netmask: parts[1],
            });
          } else {
            console.warn(`WARNING: Invalid subnet format: ${subnetStr}`);
          }
        }
      }

      return subnets;
    } catch (error) {
      throw new Error(`Failed to parse subnets: ${error}`);
    }
  }

  public injectReservations(
    xmlContent: string,
    reservations: Reservation[]
  ): string {
    try {
      const jsonObj = this.parser.parse(xmlContent);

      if (!jsonObj.opnsense) {
        jsonObj.opnsense = {};
      }

      const root = jsonObj.opnsense;

      if (!root.OPNsense) {
        root.OPNsense = {};
      }

      const opnSense = root.OPNsense;

      if (!opnSense.Kea) {
        opnSense.Kea = {};
      }

      if (!opnSense.Kea.dhcp4) {
        opnSense.Kea.dhcp4 = {};
      }

      if (!opnSense.Kea.dhcp4.reservations) {
        opnSense.Kea.dhcp4.reservations = {};
      }

      opnSense.Kea.dhcp4.reservations.reservation = reservations.map(r => {
        const reservation: any = {
          uuid: r.uuid,
          subnet: r.subnet,
          hw_address: r.hw_address,
          ip_address: r.ip_address,
        };

        if (r.hostname) {
          reservation.hostname = r.hostname;
        }
        if (r.description) {
          reservation.description = r.description;
        }

        return reservation;
      });

      const xmlOutput = this.builder.build(jsonObj);

      if (!xmlOutput.startsWith('<?xml')) {
        return '<?xml version="1.0"?>\n' + xmlOutput;
      }

      return xmlOutput;
    } catch (error) {
      throw new Error(`Failed to inject reservations: ${error}`);
    }
  }

  public parseConfig(xmlContent: string): {
    staticMappings: StaticMapping[];
    subnets: Subnet[];
  } {
    return {
      staticMappings: this.parseStaticMappings(xmlContent),
      subnets: this.parseSubnets(xmlContent),
    };
  }

  public validateXML(xmlContent: string): { valid: boolean; error?: string } {
    try {
      this.parser.parse(xmlContent);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
