const Dash = require('dash');

let clientInstance = null;

function getClient(contractId = null) {
    if (!clientInstance) {
        const config = {
            network: 'local',
            dapiAddresses: ['localhost:2443'],
            wallet: {
                mnemonic: 'torch hen giggle vast excite street limit tilt raccoon suggest uniform giant',
            }
        };

        // If contract ID provided, add it to apps
        if (contractId) {
            config.apps = {
                creditCapsule: { contractId: contractId }
            };
        }

        clientInstance = new Dash.Client(config);
    }
    return clientInstance;
}

module.exports = { getClient };