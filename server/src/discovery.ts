import { hostname } from 'node:os';
import { Bonjour } from 'bonjour-service';

/** Advertise only the public address. Pairing credentials never enter discovery. */
export function advertiseFrameServer(port: number) {
  const bonjour = new Bonjour(undefined, () => {
    // Multicast may be blocked on a guest network; manual addresses still work.
  });
  const service = bonjour.publish({
    name: `HomeControl - ${hostname().split('.')[0]}`.slice(0, 60),
    type: 'homecontrol',
    port,
    protocol: 'tcp',
    disableIPv6: true,
    txt: { app: 'homecontrol', version: '1' },
  });
  service.on('error', () => {});
  return () => {
    bonjour.unpublishAll(() => bonjour.destroy());
  };
}
