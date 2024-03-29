import { Peer } from './peer';
import { App } from './sdk';
import { Client, Server } from '@wishcore/wish-rpc';

const BSON = new (require('bson-buffer'))();

export interface Protocol {
    online?: (peer: Peer, client: Client) => void;
    offline?: (peer: Peer) => void;
    /**
     * Optional handler
     *
     * Add using:
     *
     * ```typescript
     * app.server.insertMethods({
     *   _get: {},
     *   get: async (req, res, context) {
     *     res.send('response');
     *   }
     * })
     * ```
     */
    handler?: { [handler: string]: any };
}

export interface ProtocolMap {
    [protocol: string]: {
        online: (peer: Peer, client: Client) => void;
        offline: (peer: Peer) => void;
        server: Server;
    };
}

export class RpcApp {
    clients: { [peer: string]: Client } = {};
    protocols: ProtocolMap = {};
    connections: { [key: string]: number } = {};

    wish: App;
    server: Server;

    constructor(private opts: {
        name: string,
        corePort?: number,
        protocols: {
            [protocol: string]: Protocol
        }
    }) {
        Object.entries(opts.protocols).forEach(([name, protocol]) => {
            this.server = new Server();
            this.server.insertMethods(protocol.handler || {});
            this.protocols[name] = { server: this.server, online: protocol.online, offline: protocol.offline };
        });

        const app = new App({
            corePort: opts.corePort || 9094,
            name: opts.name,
            protocols: Object.keys(opts.protocols),
        });

        this.wish = app;

        app.on('frame', (peer: Peer, frame: Buffer) => {
            const msg = BSON.deserialize(frame);

            if (msg.op) {
                const protocol = this.protocols[peer.protocol];

                if (!protocol) {
                    return console.log('Unhandled protocol', peer.protocol);
                }

                protocol.server.parse(
                    { id: msg.id, op: msg.op, args: msg.args },
                    (msg) => {
                        return app.requestAsync('services.send', [peer, BSON.serialize(msg)]);
                    },
                    { peer },
                    this.connections[peer.toUrl()]
                );

                return;

            } else {
                this.clients[peer.toUrl()].messageReceived(msg);
            }
        });

        app.on('online', async (peer: Peer) => {
            const protocol = this.protocols[peer.protocol];

            if (!protocol) {
                return console.log('Unhandled protocol', peer.protocol);
            }

            this.connections[peer.toUrl()] = protocol.server.open();

            const client = new Client((msg) => {
                app.send(peer, BSON.serialize(msg));
            });

            this.clients[peer.toUrl()] = client;

            protocol.online(peer, client);
        });

        app.on('offline', (peer: Peer) => {
            const protocol = this.protocols[peer.protocol];

            if (!protocol) {
                return console.log('Unhandled protocol', peer.protocol);
            }

            protocol.server.close(this.connections[peer.toUrl()]);
            delete this.connections[peer.toUrl()];
            delete this.clients[peer.toUrl()];

            protocol.offline(peer);
        });
    }
}
