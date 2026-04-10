require('dotenv').config();
const { createContract } = require('./dataContract.cjs');

(async () => {
    const contractId = await createContract();
    console.log('Contract ID: ', contractId);
})();