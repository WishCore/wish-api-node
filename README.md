# Wish Api

A library for building Wish applications.

## Install 

```sh
npm install @wishcore/wish-sdk
```

## Example

```js
const { App } = require('@wishcore/wish-sdk');

const app = new App({
    name: process.env.SID || 'MyApp',
    corePort: parseInt(process.env.CORE, 10) || 9094,
    protocols: ['chat'] });

app.on('ready', (ready) => {
    app.request('identity.create', ['John Doe'], (err, data) => {
        if (err && data.code === 304) { return console.log('Using existing identity'); }
        console.log('Identity created:', err, data);
    });
});

app.on('online', (peer) => {
    app.request('services.send', [peer, Buffer.from('Permissionless innovation!')], (err, data) => {
        // sent or not?
    });
});

app.on('frame', (peer, data) => {
    app.request('identity.get', [peer.ruid], function(err, user) {
        console.log(user.alias, 'says:', data.toString());
    });
});
```
