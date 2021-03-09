import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';

export interface WishCoreRunnerOpts {
    /** Listen for wish connections from other nodes */
    nodePort?: number;
    /** Port for listening for applications */
    appPort?: number;
    /**
     * Working directory for wish-core
     *
     * Saves and reads wish.conf and wish identity db file.
     *
     * Defaults to `./env`
     */
    cwd?: string;
    disableLocalDiscovery?: boolean
}

/**
 * Run a pre-built wish-core
 *
 * This is provided for convenience. Can be configured to run with specific ports,
 * which enables multi-node setups on a single computer for testing and development.
 */
export class WishCoreRunner {
    private platform = process.platform;
    private arch = process.arch;

    private nodePort = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 37008;
    private appPort = process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 9094;
    private cwd = './env';
    private disableLocalDiscovery = false;

    private binary: string;
    private child: ChildProcess;

    /** Stop `wish-core` */
    kill() {
        this.child.kill();
    }

    private constructor(opts: WishCoreRunnerOpts) {
        Object.assign(this, opts);
    }

    /**
     * Start up `wish-core` and returns `WishCoreRunner` instance
     *
     * Waits for the child process to start before returning. Restarts core if killed or crashes.
     */
    static async start(opts: WishCoreRunnerOpts = {}): Promise<WishCoreRunner> {
        try {
            // fs.unlinkSync('./env/wish_hostid.raw');
            // fs.unlinkSync('./env/wish_id_db.bson');
        } catch (e) {}

        const instance = new WishCoreRunner(opts)

        instance.binary = join(__dirname + `/../../bin/wish-core-${instance.arch}-${instance.platform}`);

        if (
            instance.arch === 'arm64' &&
            instance.platform === 'darwin'
        ) {
            // exception for m1 macs until native build is available
            instance.arch = 'x64';
        }

        await instance.spawn();

        return instance;
    }

    private spawn(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('Starting Wish Core:', this.binary);
            // const core = child.spawn('./wish-core', ['-p 38001', '-a 9095', '-r', '-s'], { cwd: './env', stdio: 'inherit' });
            const core = spawn(
                this.binary,
                ['-p ' + this.nodePort, '-a ' + this.appPort, '-s', ...this.disableLocalDiscovery ? ['-l', '-b'] : []],
                { cwd: this.cwd, stdio: 'inherit' }
            );

            this.child = core;

            process.on('exit', () => core.kill());

            function running() {
                console.log('Running...');
                resolve();
            }

            const coreTimeout = setTimeout(() => { running(); }, 200);

            core.on('error', (err) => {
                console.log('wish> Failed to start wish-core process.', err);
                clearTimeout(coreTimeout);
            });
            /*
            core.stdout.on('data', (data) => {
                console.log('\x1b[35mwish>', data.toString().trim());
            });

            core.stderr.on('data', (data) => {
                console.log('wish>', data.toString().trim());
            });
            */

            core.on('exit', (code) => {
                if (code === null) {
                    setTimeout(async () => { await this.spawn(); }, 1000);
                }
                if (code !== 0) { console.log('wish exited with code:', code); }
                clearTimeout(coreTimeout);
            });
        });
    }
}
