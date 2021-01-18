
export class Peer {
    name: string;
    luid: Buffer;
    ruid: Buffer;
    rhid: Buffer;
    rsid: Buffer;
    protocol: string;
    online: boolean;

    private constructor() {

    }

    static from(peerLike: any): Peer {
        const peer = new Peer();

        Object.assign(peer, peerLike);

        return peer;
    }

    toUrl() {
        return [
            this.luid.toString('hex') + '>',
            this.ruid.toString('hex') + '@',
            this.rhid.toString('hex') + '/',
            this.rsid.toString('hex') + '/',
            this.protocol
        ].join('');
    }

    equals(b: Peer) {
        return this.toUrl() === b.toUrl();
    }

    toString(): string {
        return [
            '<Peer ',
            this.luid.toString('hex').substr(0, 6) + '>',
            this.ruid.toString('hex').substr(0, 6) + '@',
            this.rhid.toString('hex').substr(0, 6) + '/',
            this.rsid.toString('hex').substr(0, 6) + '/',
            this.protocol + '>'
        ].join('');
    }
}
