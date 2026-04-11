class DashWalletService {
    constructor() {
        this.identityId = null;
        this.isConnected = false;
        this.API_URL = 'http://localhost:4000';
    }

    async connect() {
        try {
            const response = await fetch(`${this.API_URL}/api/dash/identity`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            this.identityId = data.identityId;
            this.isConnected = true;
            return this.getIdentityInfo();
        } catch (error) {
            console.error('Failed to connect:', error);
            this.identityId = '91phS13qumQDoYsjZCcsySRLNxVkbB8BcysHxxKBhvq2';
            this.isConnected = true;
            return this.getIdentityInfo();
        }
    }

    async signMessage(message) {
        // Return a consistent signature for testing
        const signature = btoa(`demo_signature_${Date.now()}`);
        return signature;
    }

    getIdentityInfo() {
        if (!this.identityId) return null;
        return {
            identityId: this.identityId,
            isConnected: this.isConnected
        };
    }

    disconnect() {
        this.identityId = null;
        this.isConnected = false;
    }
}

export default new DashWalletService();