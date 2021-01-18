import { EventEmitter } from 'events';
import { Socket } from 'net';

type ExpectCallback = (error: Error | null, msg?: Buffer) => void | null;

export class SocketProtocol extends EventEmitter {
    cur = 0;
    cntIn = 0;
    expectBytes: number;
    write: (data: Buffer) => void;
    expectCallback: ExpectCallback;

    constructor (private socket: Socket) {
        super();
        this.write = socket.write.bind(socket);
        this.expectBytes = 0;
        this.expectCallback = null;

        socket.on('readable', this.readable.bind(this));

        socket.on('error', (err) => {
            if ( typeof this.expectCallback === 'function' ) {
                this.expectCallback(err);
            }
        });

        // socket.on('connect', function() { this.emit('connect', arguments); });
    }


    expect(bytes: number, callback: ExpectCallback) {
        // console.log('Expecting:', bytes);
        this.expectBytes = bytes;
        this.expectCallback = callback;
    }

    private kick() {
    }

    private bytes() {
        return this.cur;
    }

    drop() {
        if (this.socket) {
            this.socket.removeListener('readable', this.readable);
        }
        this.expectBytes = 0;

        this.expectCallback = null;
    }

    close() {
        if (this.socket) {
            this.socket.removeListener('readable', this.readable);
            this.socket.end();
        }
        this.expectBytes = 0;
        this.expectCallback = null;
    }

    private readable() {
        let chunk;
        if (this.expectBytes) {
            while (null !== (chunk = this.socket.read(this.expectBytes))) {
                this.cntIn += chunk.length;

                if (this.expectCallback) {
                    this.expectCallback(null, chunk);
                } else {
                    console.log('Nothing expected, but got some data... waiting... data is lost', this.expectCallback);
                    this.socket.removeListener('readable', this.readable);
                }
            }
        } else {
            console.log('Nothing expected, but got some data... waiting for next readable?!');
        }
    }
}
