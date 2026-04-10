const { getClient } = require('./dashClient.js');

const client = getClient();

async function createIdentity() {
    const identity = await client.platform.identities.register();
    return identity.getId().toString();
}

async function getIdentity() {
    const account = await client.wallet.getAccount();
    const identities = await account.identities.getIdentityIds();
    return identities;
}

module.exports = {
    createIdentity,
    getIdentity,
};