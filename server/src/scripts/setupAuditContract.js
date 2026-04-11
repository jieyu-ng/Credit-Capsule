import { getClient } from '../services/dashClient.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupAuditContract() {
    const client = getClient();

    try {
        const identityId = process.env.DASH_IDENTITY_ID;
        const identity = await client.platform.identities.get(identityId);

        if (!identity) {
            console.error('Identity not found:', identityId);
            process.exit(1);
        }

        console.log('🔑 Using identity:', identityId);

        // CORRECTED schema with position fields (required by Dash SDK v6)
        const contractDocuments = {
            capsuleAudit: {
                type: "object",
                properties: {
                    userId: { type: "string", position: 0, maxLength: 63 },
                    userAddress: { type: "string", position: 1, maxLength: 63 },
                    rulesHash: { type: "string", position: 2, maxLength: 66 },
                    capsuleLimit: { type: "integer", position: 3 },
                    capsuleType: { type: "string", position: 4, maxLength: 20 },
                    emergencyType: { type: "string", position: 5, maxLength: 50 },
                    timestamp: { type: "integer", position: 6 }
                },
                additionalProperties: false,
                indices: [
                    {
                        name: "userIdIndex",
                        properties: [
                            { userId: "asc" }
                        ]
                    },
                    {
                        name: "timestampIndex",
                        properties: [
                            { timestamp: "asc" }
                        ]
                    }
                ]
            },
            txnAudit: {
                type: "object",
                properties: {
                    userId: { type: "string", position: 0, maxLength: 63 },
                    userAddress: { type: "string", position: 1, maxLength: 63 },
                    merchant: { type: "string", position: 2, maxLength: 100 },
                    mcc: { type: "string", position: 3, maxLength: 20 },
                    amount: { type: "integer", position: 4 },
                    approved: { type: "boolean", position: 5 },
                    riskTier: { type: "string", position: 6, maxLength: 10 },
                    timestamp: { type: "integer", position: 7 }
                },
                additionalProperties: false,
                indices: [
                    {
                        name: "userIdIndex",
                        properties: [
                            { userId: "asc" }
                        ]
                    },
                    {
                        name: "timestampIndex",
                        properties: [
                            { timestamp: "asc" }
                        ]
                    }
                ]
            }
        };

        console.log('📝 Creating audit data contract...');
        console.log('Documents:', Object.keys(contractDocuments));

        // Create the contract
        const contract = await client.platform.contracts.create(
            contractDocuments,
            identity
        );

        // Publish the contract
        await client.platform.contracts.publish(contract, identity);

        const auditContractId = contract.getId().toString();
        console.log('\n✅ AUDIT CONTRACT CREATED!');
        console.log('📋 Audit Contract ID:', auditContractId);
        console.log('\n📝 Add this to your .env file:');
        console.log(`DASH_AUDIT_CONTRACT_ID=${auditContractId}`);
        console.log('ENABLE_DASH_AUDIT=true');

    } catch (error) {
        console.error('Setup failed:', error);
        if (error.message) console.error('Error details:', error.message);
        process.exit(1);
    }
}

setupAuditContract();