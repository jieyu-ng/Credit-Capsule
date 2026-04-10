require('dotenv').config();

const { createCapsule } = require('./capsule.cjs');

const CONTRACT_ID = '7F3LF8wTx3QpddwMQgoN1NNQsRvHjQDaVq4yFYvJrC6e';

(async () => {
    const identityId = '91phS13qumQDoYsjZCcsySRLNxVkbB8BcysHxxKBhvq2';

    const doc = await createCapsule(identityId, CONTRACT_ID, 750);

    console.log('DOCUMENT CREATED:', doc.toJSON());
})();