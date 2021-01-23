import { spawn } from "child_process";

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

    /**
     * Start up Wish core.
     *
     * Looks for environment variable WISH pointing at a binary to run or falls
     * back to using bundled binary from wish-sdk.
     */
    start(): Promise<any> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                // fs.unlinkSync('./env/wish_hostid.raw');
                // fs.unlinkSync('./env/wish_id_db.bson');
            } catch (e) {}

            const sdkWishBinary = __dirname + `/../bin/wish-core-${this.arch}-${this.platform}`;

            await this.spawn();
            resolve();
        });
    }

    private spawn(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('Starting Wish Core.');
            // const core = child.spawn('./wish-core', ['-p 38001', '-a 9095', '-r', '-s'], { cwd: './env', stdio: 'inherit' });
            const core = spawn(
                './wish-core',
                ['-p ' + this.nodePort, '-a ' + this.appPort, '-s'],
                { cwd: './env', stdio: 'inherit' }
            );

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
