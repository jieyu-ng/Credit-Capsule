const Dash = require('dash');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function setupLocal() {
    console.log('\n🔧 Setting up local Dash environment...\n');

    const client = new Dash.Client({
        network: 'local',
        dapiAddresses: ['localhost:3000'],
        wallet: {
            mnemonic: process.env.DASH_MNEMONIC || 'torch hen giggle vast excite street limit tilt raccoon suggest uniform giant',
        }
    });

    try {
        // Step 1: Test connection
        console.log('📡 Step 1: Testing connection to local Dash...');
        const status = await client.getDAPIClient().core.getBlockchainStatus();
        console.log(`   ✅ Connected! Block height: ${status.headers}\n`);

        // Step 2: Get wallet info
        console.log('💰 Step 2: Checking wallet...');
        const account = await client.wallet.getAccount();
        const balance = await account.getBalance();
        console.log(`   ✅ Wallet balance: ${balance / 1e8} DASH\n`);

        // Step 3: Create or get identity
        console.log('🆔 Step 3: Setting up identity...');
        let identityIds = await account.identities.getIdentityIds();
        let identity;

        if (identityIds.length === 0) {
            console.log('   Creating new identity...');
            identity = await client.platform.identities.register();
            console.log(`   ✅ Identity created: ${identity.getId()}`);

            // Mine blocks to confirm
            console.log('   ⛏️  Mining confirmation blocks...');
            await client.wallet.generateBlocks(5, identity.getId());
        } else {
            identity = await client.platform.identities.get(identityIds[0]);
            console.log(`   ✅ Using existing identity: ${identity.getId()}`);
        }
        console.log('');

        // Step 4: Create contract
        console.log('📝 Step 4: Creating data contract...');
        const documents = {
            creditCapsule: {
                type: 'object',
                properties: {
                    ownerId: { type: 'string', position: 0 },
                    rulesHash: { type: 'string', position: 1 },
                    rules: { type: 'string', position: 2 },
                    score: { type: 'integer', position: 3 },
                    createdAt: { type: 'integer', position: 4 }
                },
                required: ['ownerId', 'rulesHash', 'createdAt'],
                additionalProperties: false
            }
        };

        const contract = await client.platform.contracts.create(documents, identity);
        await client.platform.contracts.publish(contract, identity);
        console.log(`   ✅ Contract created: ${contract.getId()}`);

        // Mine blocks to confirm
        console.log('   ⛏️  Mining confirmation blocks...');
        await client.wallet.generateBlocks(5, identity.getId());
        console.log('');

        // Step 5: Update .env file
        console.log('💾 Step 5: Updating .env file...');
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Update or add DASH_CONTRACT_ID
        if (envContent.includes('DASH_CONTRACT_ID=')) {
            envContent = envContent.replace(/DASH_CONTRACT_ID=.*/, `DASH_CONTRACT_ID=${contract.getId()}`);
        } else {
            envContent += `\nDASH_CONTRACT_ID=${contract.getId()}`;
        }

        // Update or add DASH_IDENTITY_ID
        if (envContent.includes('DASH_IDENTITY_ID=')) {
            envContent = envContent.replace(/DASH_IDENTITY_ID=.*/, `DASH_IDENTITY_ID=${identity.getId()}`);
        } else {
            envContent += `\nDASH_IDENTITY_ID=${identity.getId()}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log('   ✅ .env file updated!\n');

        // Step 6: Test document creation
        console.log('🧪 Step 6: Testing document creation...');
        const testDoc = await client.platform.documents.create(
            {
                $contractId: contract.getId(),
                $type: 'creditCapsule',
            },
            identity,
            {
                ownerId: identity.getId(),
                rulesHash: '0x' + require('crypto').createHash('sha256').update('test').digest('hex'),
                rules: JSON.stringify({ test: true }),
                createdAt: Date.now(),
            }
        );

        await client.platform.documents.broadcast({ create: [testDoc] }, identity);
        await client.wallet.generateBlocks(5, identity.getId());
        console.log(`   ✅ Test document created: ${testDoc.getId()}\n`);

        // Summary
        console.log('🎉 ========== SETUP COMPLETE! ==========');
        console.log(`📍 Identity ID: ${identity.getId()}`);
        console.log(`📍 Contract ID: ${contract.getId()}`);
        console.log(`📍 Wallet Address: ${await account.getAddress()}`);
        console.log(`💰 Wallet Balance: ${balance / 1e8} DASH`);
        console.log('=========================================\n');

        console.log('🚀 You can now start your server:');
        console.log('   npm run dev\n');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\n💡 Make sure your local Dash Platform is running:');
        console.log('   docker ps | grep dapi');
    } finally {
        await client.disconnect();
    }
}

setupLocal();