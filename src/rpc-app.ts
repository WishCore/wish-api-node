import { Peer } from './peer';
import { App } from './sdk';
import { Client, Server } from '@wishcore/wish-rpc';

const BSON = new (require('bson-buffer'))();

interface Handler {
    online?: (peer: Peer, client: Client) => void;
    offline?: (peer: Peer) => void;
    handler: { [handler: string]: any };
}

interface ProtocolMap {
    [protocol: string]: {
        online: any;
        offline: any;
        server: Server;
    };
}

class RpcApp {
    clients: { [peer: string]: any } = {};
    protocols: ProtocolMap = {};
    connections: { [key: string]: number } = {};

    wish: App;

    constructor(private opts: {
        name: string,
        corePort: number,
        protocols: {
            [protocol: string]: Handler
        }
    }) {
        Object.entries(opts.protocols).forEach(([protocol, handler]) => {
            const server = new Server();
            server.insertMethods(handler.handler);
            this.protocols[protocol] = { server, online: handler.online, offline: handler.offline };
        });

        const app = new App({
            corePort: opts.corePort,
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
                        app.request('services.send', [peer, BSON.serialize(msg)], (err, data) => {
                            // send or not?
                        });
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
