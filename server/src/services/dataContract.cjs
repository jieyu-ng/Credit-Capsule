const { getClient } = require('./dashClient.cjs');

async function createContract() {
    let client;
    try {
        console.log('Starting contract creation...');
        client = getClient();
        const account = await client.wallet.getAccount();

        const identityIds = await account.identities.getIdentityIds();
        if (!identityIds || identityIds.length === 0) {
            throw new Error('No identity found. Please register an identity first.');
        }

        const identityId = identityIds[0];
        console.log('Identity ID:', identityId);

        const identity = await client.platform.identities.get(identityId);

        // CORRECTED SCHEMA for SDK v6.x - includes position fields
        const documents = {
            creditCapsule: {
                type: 'object',
                properties: {
                    ownerId: {
                        type: 'string',
                        position: 0,           // REQUIRED for v0.25.16+
                        description: "Owner's identity ID"
                    },
                    score: {
                        type: 'integer',
                        position: 1,           // REQUIRED: unique position number
                        minimum: 0,
                        maximum: 1000
                    },
                    createdAt: {
                        type: 'integer',
                        position: 2,           // REQUIRED: unique position number
                        minimum: 0
                    }
                },
                required: ['ownerId', 'score', 'createdAt'],
                additionalProperties: false
            }
        };

        console.log('Creating contract with position fields...');
        const contract = await client.platform.contracts.create(documents, identity);

        console.log('Publishing contract...');
        await client.platform.contracts.publish(contract, identity);

        const contractId = contract.getId().toString();

        return contractId;

    } catch (error) {
        console.error('\n❌ Contract creation failed:');
        const errorMessage = error.message || error.toString() || 'Unknown error';
        console.error('Error message:', errorMessage);

        // Check for specific error types
        if (errorMessage.includes('position')) {
            console.error('\n💡 Each property needs a unique "position" number (0, 1, 2, ...)');
        } else if (errorMessage.includes('byteArray')) {
            console.error('\n💡 For binary data, use type: "array" with byteArray: true');
        }

        throw new Error(`Contract creation failed: ${errorMessage}`);
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

module.exports = { createContract };