import { WishCoreRunner } from '../../src/wish-core-runner';
import mkdirp = require('mkdirp');

export class DevelopmentEnvironment {
    static instance: DevelopmentEnvironment = null;

    wishs: WishCoreRunner[] = [];
    wish: WishCoreRunner;

    private constructor() {}

    static async getInstance() {
        if (!DevelopmentEnvironment.instance) {
            DevelopmentEnvironment.instance = new DevelopmentEnvironment();
            await DevelopmentEnvironment.instance.init();
        }

        return DevelopmentEnvironment.instance;
    }

    private async init() {
        const workingDir1 = './test/env/test-1';
        const workingDir2 = './test/env/test-2';
        mkdirp.sync(workingDir1);
        mkdirp.sync(workingDir2);

        console.log('Working dir', workingDir1);

        this.wishs.push(await WishCoreRunner.start({ appPort: 9095, nodePort: 38100, cwd: workingDir1 }));
        this.wishs.push(await WishCoreRunner.start({ appPort: 9096, nodePort: 38101, cwd: workingDir2 }));

        // this.clients.push(new Client({ host: 'ws://localhost:8080' }));
        // this.clients.push(new Client({ host: 'ws://localhost:8081' }));

        await new Promise((resolve) => { setTimeout(resolve, 300); });

        this.wish = this.wishs[0];
    }
}

