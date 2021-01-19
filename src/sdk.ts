import { Socket } from 'net';
import { SocketProtocol } from './protocol';
import { EventEmitter } from 'events';
import { Peer } from './peer';

const BSON = new (require('bson-buffer'))();

export class App extends EventEmitter {
    name: string;
    tcp: Socket;
    protocol: SocketProtocol;
    protocols: string[];
    host = '127.0.0.1';
    port = 9094;

    private requestMap: { [requestId: string]: (response: any) => void } = {};

    id = 0;

    peers: { [id: string]: Peer; } = {};

    private state: 'connecting' | 'connected' = 'connecting';

    constructor(private opts: {
        name: string,
        corePort: number,
        protocols?: string[]
    }) {
        super();

        this.port = opts.corePort;
        this.name = opts.name;
        this.protocols = opts.protocols || [];

        this.connect();
    }

    async send(peer: Peer, frame: Buffer) {
        this.tcp.write(this.createFrame({ op: 'services.send', args: [peer, frame] }));
    }

    requestAsync(op: string, args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.requestMap[++this.id] = (msg: any) => {
                if (msg.err) {
                    return reject(msg.data);
                }

                resolve(msg.data);
            };
            this.tcp.write(this.createFrame({ op, args, id: this.id }));
        });
    }

    request(op: string, args: any[], cb?): number | Promise<any> {
        if (typeof cb !== 'function') {
            return new Promise((resolve, reject) => {
                this.requestMap[++this.id] = (msg: any) => {
                    if (msg.err) {
                        return reject(msg.data);
                    }

                    resolve(msg.data);
                };
                this.tcp.write(this.createFrame({ op, args, id: this.id }));
            });
        }

        this.requestMap[++this.id] = (msg: any) => { cb(!!msg.err, msg.data); };
        this.tcp.write(this.createFrame({ op, args, id: this.id }));
        return this.id;
    }

    requestBare(op: string, args: any[], cb) {
        this.requestMap[++this.id] = cb;
        this.tcp.write(this.createFrame({ op, args, id: this.id }));
    }

    async connect() {
        this.tcp = new Socket();

        this.protocol = new SocketProtocol(this.tcp);

        this.waitFrame();

        this.tcp.connect(this.port, this.host, () => {
            const wsid = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');

            wsid.write(this.name, 0);

            this.tcp.write(this.createLoginFrame({ wsid, name: this.name, protocols: this.protocols, permissions: [] }));
        });

        this.tcp.on('close', function() {
            console.log('Connection closed');
        });
    }

    private async waitFrame() {
        this.protocol.expect(2, (error: Error | null, data?: Buffer) => {
            if (error) {
                return console.log('Failed waiting for frame header', error);
            }
            const len = data.readInt16BE(0);

            this.protocol.expect(len, (error: Error | null, data?: Buffer) => {
                this.waitFrame();

                const msg = BSON.deserialize(data);

                if (msg.signal === 'ready') {
                    if (this.state === 'connecting') {
                        this.tcp.write(this.createFrame({ ready: true }));
                        this.state = 'connected';
                        this.emit('ready', true);
                    }
                    return;
                }

                if (msg.type === 'frame') {
                    this.emit('frame', Peer.from(msg.peer), msg.data);
                    return;
                }

                if (msg.type === 'peer') {
                    const peer = Peer.from(msg.peer);

                    const url = peer.toUrl();

                    this.peers[url] = peer;

                    if (peer.online) {
                        this.emit('online', peer);
                    } else {
                        this.emit('offline', peer);
                    }
                    return;
                }

                if (msg.err || msg.sig || msg.ack) {
                    const id = msg.err || msg.sig || msg.ack;
                    if (this.requestMap[id]) {
                        this.requestMap[id](msg);

                        if (!msg.sig) {
                            delete this.requestMap[id];
                        }
                    }
                    return;
                }

                console.log('msg', msg);
            });
        });
    }

    private createFrame(data: any) {
        const body: Buffer = BSON.serialize(data);
        const header = Buffer.alloc(2);

        header.writeInt16BE(body.length, 0);

        return Buffer.concat([header, body]);
    }

    private createLoginFrame(data: any) {
        return Buffer.concat([Buffer.from('W.\x19'), this.createFrame(data)]);
    }
}
