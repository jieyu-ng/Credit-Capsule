import { getClient, mineBlocks } from './dashClient.js';

export async function logCapsuleToDash(userId, userAddress, rulesHash, capsuleLimit, capsuleType, emergencyType = null) {
    const client = getClient();

    try {
        const identityId = process.env.DASH_IDENTITY_ID;
        const identity = await client.platform.identities.get(identityId);

        if (!identity) {
            console.log('⚠️ No Dash identity found for audit');
            return { ok: false, error: 'No identity' };
        }

        const typeLocator = 'creditCapsuleApp.creditCapsuleV3';

        const account = await client.wallet.getAccount();
        const address = await account.getUnusedAddress();
        const miningAddress = address.address;

        const safeRulesHash = rulesHash.length > 66 ? rulesHash.substring(0, 66) : rulesHash;

        // MATCH THE EXACT STRUCTURE FROM testDirectAudit.js
        const doc = await client.platform.documents.create(
            typeLocator,
            identity,
            {
                ownerId: identityId,
                rulesHash: safeRulesHash,
                rules: JSON.stringify({
                    __type: 'CAPSULE_AUDIT',
                    userId: String(userId),
                    userAddress: String(userAddress || ''),
                    capsuleLimit: Number(capsuleLimit) || 0,
                    capsuleType: String(capsuleType || 'REGULAR'),
                    emergencyType: String(emergencyType || ''),
                    timestamp: Date.now()
                }),
                capsuleType: capsuleType === 'EMERGENCY' ? 'EMERGENCY' : 'REGULAR',
                emergencyType: emergencyType || "",
                createdAt: Date.now(),
            }
        );

        await client.platform.documents.broadcast({ create: [doc] }, identity);

        if (process.env.DASH_NETWORK === 'local') {
            await mineBlocks(5, miningAddress);
        }

        console.log(`✅ Capsule audit stored on Dash: ${doc.getId()}`);
        return { ok: true, documentId: doc.getId().toString() };

    } catch (error) {
        console.error('Failed to log capsule to Dash:', error.message);
        return { ok: false, error: error.message };
    }
}

export async function logTxnToDash(userId, userAddress, merchant, mcc, amount, approved, riskTier) {
    const client = getClient();

    try {
        const identityId = process.env.DASH_IDENTITY_ID;
        const identity = await client.platform.identities.get(identityId);

        if (!identity) {
            console.log('⚠️ No Dash identity found for audit');
            return { ok: false, error: 'No identity' };
        }

        const typeLocator = 'creditCapsuleApp.creditCapsuleV3';

        const account = await client.wallet.getAccount();
        const address = await account.getUnusedAddress();
        const miningAddress = address.address;

        const timestamp = Date.now();
        const rulesHash = `audit_txn_${timestamp}_${userId}`;

        // MATCH THE EXACT STRUCTURE FROM testDirectAudit.js
        // Remove score and expiryDate since the test doesn't use them
        const doc = await client.platform.documents.create(
            typeLocator,
            identity,
            {
                ownerId: identityId,
                rulesHash: rulesHash,
                rules: JSON.stringify({
                    __type: 'TRANSACTION_AUDIT',
                    userId: String(userId),
                    userAddress: String(userAddress || ''),
                    merchant: String(merchant || ''),
                    mcc: String(mcc || ''),
                    amount: Number(amount) || 0,
                    approved: Boolean(approved),
                    riskTier: String(riskTier || ''),
                    timestamp: timestamp
                }),
                capsuleType: 'AUDIT',
                emergencyType: "",
                createdAt: timestamp,
            }
        );

        await client.platform.documents.broadcast({ create: [doc] }, identity);

        if (process.env.DASH_NETWORK === 'local') {
            await mineBlocks(5, miningAddress);
        }

        console.log(`✅ Transaction audit stored on Dash: ${doc.getId()}`);
        return { ok: true, documentId: doc.getId().toString() };

    } catch (error) {
        console.error('Failed to log transaction to Dash:', error.message);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        return { ok: false, error: error.message };
    }
}

export async function getUserAuditLogs(userId, limit = 50) {
    const client = getClient();

    try {
        const typeLocator = 'creditCapsuleApp.creditCapsuleV3';
        const docs = await client.platform.documents.get(typeLocator, { limit: 100 });

        const auditLogs = [];

        for (const doc of docs) {
            try {
                const rules = JSON.parse(doc.rules);
                if (rules.__type && (rules.__type === 'CAPSULE_AUDIT' || rules.__type === 'TRANSACTION_AUDIT') && rules.userId === userId) {
                    auditLogs.push({
                        id: doc.getId(),
                        type: rules.__type,
                        ...rules,
                        documentId: doc.getId().toString()
                    });
                }
            } catch (e) {
                // Skip documents without parsable rules
            }
        }

        auditLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return { ok: true, logs: auditLogs.slice(0, limit) };

    } catch (error) {
        console.error('Failed to query audit logs:', error.message);
        return { ok: false, error: error.message, logs: [] };
    }
}