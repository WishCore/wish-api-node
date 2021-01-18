/*
const app = new RpcApp({
    corePort: 9094,
    name: 'Rpc',
    protocols: {
        reason: {
            handler: {
                _signals: {},
                signals: async (req, res, context) => {
                    // console.log('RpcApp got signal request');
                    res.emit('ok');
                },
                _user: {},
                user: {
                    _get: {
                        doc: 'Returns user by id',
                        args: () => Joi.object({ uid: Joi.string() }),
                        result: () =>  Joi.object({ name: Joi.string() }),
                    },
                    get: async (req, res, context) => {
                        res.send({ name: 'Mini' });
                    }
                },
                _document: {},
                document: {
                    _sync: {},
                    sync: (req, res, context) => {
                        res.send({ 'asdasdasdsadsadasdasd': true });
                    },
                    _get: {},
                    get: async (req, res, context) => {
                        res.send({});
                    }
                }
            },
            online: (peer: Peer, client: Client) => {
                // const hash = Buffer.from('B0gIv7gZn5EaUB9X92Y2/FDYJ82XOu7T1fN+LFbO4sY=', 'base64');
                const hash = Buffer.from('cf09ddc7d205d9c13e3b4119d86b9edec495e9d7e6c62c915acae4fd51079490', 'hex');
                const name = '/tmp/' + hash.toString('hex');
                const file = createWriteStream(name);

                console.log('opening file for writing:', name);

                try {
                    mkdirSync('./tmp/files');
                } catch (e) {}
                try {
                    mkdirSync('./tmp/files/' + hash.toString('hex').substr(0, 2));
                } catch (e) {}

                client.request('document.file', [hash], (err, data, end) => {
                    if (end) {
                        file.close();
                        file.on('close', () => {
                            renameSync(name, './tmp/' + WebHttp.pathFromHash(hash.toString('hex')));
                            console.log('saved file');
                        });
                        return;
                    }

                    file.write(data);
                });

                client.request('signals', [], (err, signal) => {
                    app.wish.request('identity.get', [peer.ruid], (err, user) => {
                        console.log('signal:', user ? user.alias + ' (' + peer.name + ')' : 'unknown', signal);
                    });
                });
            }
        }
    }
});
*/