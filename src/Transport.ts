import * as FbsTransport from '@mafalda-sfu/mediasoup-node-fbs/transport';

/**
 * Transport protocol.
 */
export type TransportProtocol = 'udp' | 'tcp';

export type TransportTuple =
{
  localIp: string;
  localPort: number;
  remoteIp?: string;
  remotePort?: number;
  protocol: TransportProtocol;
};

export function serializeProtocol(protocol: TransportProtocol): FbsTransport.Protocol
{
  switch (protocol)
  {
    case 'udp':
    {
      return FbsTransport.Protocol.UDP;
    }

    case 'tcp':
    {
      return FbsTransport.Protocol.TCP;
    }
  }
}