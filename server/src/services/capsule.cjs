const { getClient } = require('./dashClient.cjs');

async function createCapsule(identityId, contractId, score) {
    // Initialize client WITH the contract
    const client = getClient(contractId);

    try {
        const identity = await client.platform.identities.get(identityId);

        // Now create the document - app name must match what's in config
        const doc = await client.platform.documents.create(
            'creditCapsule.creditCapsule',  // appName.documentType
            identity,
            {
                ownerId: identityId,
                score: score,
                createdAt: Date.now(),
            }
        );

        await client.platform.documents.broadcast(
            { create: [doc] },
            identity
        );

        console.log('✅ Document created:', doc.getId());
        return doc;

    } catch (error) {
        console.error('❌ Error creating capsule:', error);
        throw error;
    } finally {
        await client.disconnect();
    }
}

async function getCapsules(contractId) {
    const client = getClient();

    const docs = await client.platform.documents.get(
        `${contractId}.creditCapsule`,
        { limit: 10 }
    );

    return docs.map(d => d.toJSON());
}

module.exports = {
    createCapsule,
    getCapsules,
};

module.exports = { createCapsule };