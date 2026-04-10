const Dash = require('dash');

// Replace with your mnemonic
const MNEMONIC = 'special farm trash glare scatter state size army flat sword blood glance';

async function checkBalance() {
    const client = new Dash.Client({
        network: 'local',
        dapiAddresses: ['localhost:2443'],
        wallet: { mnemonic: MNEMONIC }
    });

    try {
        const account = await client.wallet.getAccount();
        const balance = account.getConfirmedBalance();
        const unconfirmedBalance = account.getUnconfirmedBalance();
        const identity = await client.platform.identities.get('CbCWSTjFqM3xEirQC6vTuf51Etk5Mf76nDM3FfBbBihk');
        const identityBalance = identity.balance; // Balance in duffs (1 Dash = 100,000,000 duffs)

        console.log(`Identity ID: ${identity.getId()}`);
        console.log(`Balance: ${Number(identityBalance) / 100000000} Dash`);

        console.log('\n💰 WALLET BALANCE');
        console.log('='.repeat(40));
        console.log(`Confirmed:   ${Number(balance) / 100000000} Dash`);
        console.log(`Unconfirmed: ${Number(unconfirmedBalance) / 100000000} Dash`);
        console.log(`Total:       ${(Number(balance) + Number(unconfirmedBalance)) / 100000000} Dash`);
        console.log('='.repeat(40));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.disconnect();
    }
}

checkBalance();