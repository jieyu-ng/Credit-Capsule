const Dash = require('dash');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { getClient } = require('./dashClient.cjs');

// Get the client instance ONCE
const client = getClient();
const MNEMONIC = client.wallet.mnemonic;

let PERMANENT_ADDRESS = null;

async function getPermanentAddress() {
    if (!PERMANENT_ADDRESS) {
        const account = await client.wallet.getAccount();
        PERMANENT_ADDRESS = await account.getUnusedAddress();
        console.log(`📍 Permanent wallet address: ${PERMANENT_ADDRESS.address}`);
    }
    return PERMANENT_ADDRESS;
}

async function generateBlocks(count, address) {
    console.log(`⛏️  Generating ${count} block(s) to ${address}...`);
    try {
        const { stdout } = await execPromise('docker ps --filter "name=core" --format "{{.Names}}"');
        const containerName = stdout.trim().split('\n');
        selectedContainer = containerName.find(name => name.includes('seed'));

        await execPromise(
            `docker exec ${selectedContainer} dash-cli -regtest generatetoaddress ${count} ${address}`
        );
        console.log(`✅ ${count} block(s) generated`);
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
        console.error('Block generation failed:', error.message);
    }
}

async function getOrCreateIdentity() {
    const account = await client.wallet.getAccount();
    const identityIds = await account.identities.getIdentityIds();

    if (identityIds.length > 0) {
        console.log('Using existing identity:', identityIds[0]);
        return identityIds[0];
    }

    console.log('Registering new identity...');
    const identity = await client.platform.identities.register();
    return identity.getId().toString();
}

async function topupIdentity() {
    try {
        console.log('\n🆔 Setting up Identity...');
        console.log('='.repeat(50));

        const permanentAddress = await getPermanentAddress();
        console.log(`\n💎 Using wallet address: ${permanentAddress.address}`);

        console.log('\n💰 Checking initial wallet balance...');
        let account = await client.wallet.getAccount();
        let balance = account.getConfirmedBalance();
        console.log(`Wallet balance: ${Number(balance) / 100000000} Dash`);

        await generateBlocks(100, permanentAddress.address);

        console.log('⏳ Waiting for wallet to sync (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        account = await client.wallet.getAccount();
        await account.fetchStatus();
        balance = account.getConfirmedBalance(); // Re-fetch the balance!
        console.log(`Wallet balance: ${Number(balance) / 100000000} Dash`);

        console.log('\n⛏️  Mining 100 additional blocks to mature coinbase (required for spending)...');
        await generateBlocks(100, permanentAddress.address);

        console.log('⏳ Waiting for wallet to sync (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        account = await client.wallet.getAccount();
        balance = account.getConfirmedBalance();
        console.log(`💰 Wallet balance after maturity: ${Number(balance) / 100000000} Dash`);

        const identityId = await getOrCreateIdentity();
        console.log(`✅ Identity: ${identityId}`);

        console.log('\n⛏️  Confirming registration...');
        await generateBlocks(5, permanentAddress.address);

        console.log('\n💸 Topping up identity with 0.1 Dash...');
        await client.platform.identities.topUp(identityId, 20000000);
        console.log(`✅ Top-up submitted`);

        // Generate blocks to confirm
        console.log('\n⛏️  Confirming top-up...');
        await generateBlocks(5, permanentAddress.address);

        // Check final balance
        await new Promise(resolve => setTimeout(resolve, 3000));
        const updatedIdentity = await client.platform.identities.get(identityId);
        const finalBalance = updatedIdentity.getBalance();

        console.log('\n' + '='.repeat(50));
        console.log('🎉 SUCCESS!');
        console.log('='.repeat(50));
        console.log(`📍 WALLET ADDRESS: ${permanentAddress.address}`);
        console.log(`📍 WALLET MNEMONIC: ${MNEMONIC}`);
        console.log(`🆔 Identity ID: ${identityId}`);
        console.log(`💰 Identity Balance: ${finalBalance} credits`);
        console.log('='.repeat(50));

        await client.disconnect(); // Disconnect the client
        process.exit(0); // Force exit

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    }
}

topupIdentity();