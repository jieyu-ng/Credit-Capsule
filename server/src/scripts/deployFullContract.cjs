const { getClient } = require('../services/dashClient.js');
const { generateBlocks } = require('../services/topup-identity.cjs');
const dotenv = require('dotenv');

dotenv.config();

async function deployFullContract() {
    let client;
    try {
        console.log('🚀 Deploying full contract with all fields...');
        client = getClient();
        const account = await client.wallet.getAccount();

        const identityIds = await account.identities.getIdentityIds();
        if (!identityIds || identityIds.length === 0) {
            throw new Error('No identity found. Please register an identity first.');
        }

        const identityId = identityIds[0];
        console.log('📍 Identity ID:', identityId);

        const identity = await client.platform.identities.get(identityId);

        // Full schema with all fields needed for your app
        const documents = {
            creditCapsuleV2: {
                type: 'object',
                properties: {
                    ownerId: {
                        type: 'string',
                        position: 0,
                        description: "Owner's identity ID"
                    },
                    rulesHash: {
                        type: 'string',
                        position: 1,
                        description: "SHA256 hash of capsule rules"
                    },
                    rules: {
                        type: 'string',
                        position: 2,
                        description: "JSON string of capsule rules"
                    },
                    score: {
                        type: 'integer',
                        position: 3,
                        minimum: 0,
                        maximum: 1000,
                        description: "Credit score"
                    },
                    createdAt: {
                        type: 'integer',
                        position: 4,
                        minimum: 0,
                        description: "Creation timestamp"
                    }
                },
                required: ['ownerId', 'rulesHash', 'createdAt'],
                additionalProperties: false
            }
        };

        console.log('📝 Creating contract with full schema...');
        const contract = await client.platform.contracts.create(documents, identity);

        console.log('📤 Publishing contract...');
        await client.platform.contracts.publish(contract, identity);

        const contractId = contract.getId().toString();
        console.log('\n✅ Contract deployed successfully!');
        console.log(`📄 Contract ID: ${contractId}`);

        // Mine blocks to confirm (for local network)
        if (process.env.DASH_NETWORK === 'local') {
            console.log('⛏️  Mining confirmation blocks...');
            generateBlocks(5, identityId);
        }

        console.log('\n📝 Add this to your .env:');
        console.log(`DASH_CONTRACT_ID=${contractId}`);

        return contractId;

    } catch (error) {
        console.error('\n❌ Contract creation failed:', error.message);
        if (error.message.includes('position')) {
            console.error('\n💡 Each property needs a unique "position" number (0, 1, 2, ...)');
        }
        throw error;
    } finally {
        if (client) {
            try {
                await client.disconnect();
            } catch (err) {
                // Ignore disconnect errors
            }
        }
    }
}

// Run the function
deployFullContract().catch(console.error);