import pkg from 'dash';
const { Client: DashClient } = pkg;
import dotenv from 'dotenv';
import util from 'util';
import { exec } from 'child_process';

const execPromise = util.promisify(exec);

dotenv.config();

let clientInstance = null;

export function getClient() {
    if (!clientInstance) {
        const config = {
            network: process.env.DASH_NETWORK || 'local',
            dapiAddresses: process.env.DASH_DAPI_ADDRESSES
                ? process.env.DASH_DAPI_ADDRESSES.split(',')
                : ['localhost:2443'],
            wallet: {
                mnemonic: process.env.DASH_MNEMONIC
            },
            // ✅ Add apps configuration
            apps: {
                creditCapsuleApp: {  // This is your app name (simple string)
                    contractId: process.env.DASH_CONTRACT_ID
                }
            }
        };

        console.log(`🔗 Connecting to Dash ${config.network}`);
        console.log(`📋 App configured: creditCapsuleApp -> ${process.env.DASH_CONTRACT_ID}`);
        clientInstance = new DashClient(config);
    }
    return clientInstance;
}

export async function mineBlocks(count, address) {
    const client = getClient();

    console.log(`⛏️  Mining ${count} blocks...`);
    const { stdout } = await execPromise('docker ps --filter "name=core" --format "{{.Names}}"');
    const containerName = stdout.trim().split('\n');
    const selectedContainer = containerName.find(name => name.includes('seed'));
    await execPromise(
        `docker exec ${selectedContainer} dash-cli -regtest generatetoaddress ${count} ${address}`
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`✅ Mined ${count} blocks`);
}
