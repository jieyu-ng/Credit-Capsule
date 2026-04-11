
echo "🚀 Complete Test Flow - Regular + Emergency Capsules"
echo "===================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Register
echo -e "${BLUE}1️⃣ Registering user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "test123",
    "approvedLimit": 10000
  }')

echo "Register response: $REGISTER_RESPONSE"
echo ""

# 2. Login
echo -e "${BLUE}2️⃣ Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "test123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed!${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

# ============================================
# TEST 1: Regular Capsule with Dash Anchoring
# ============================================
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📦 TEST 1: Regular Capsule with Dash Anchoring${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}3️⃣ Creating regular capsule...${NC}"
CAPSULE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/capsule/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "allowedMcc": ["GROCERY", "FUEL", "RESTAURANT"],
    "maxTransaction": 1000,
    "dailyCap": 5000,
    "capsuleLimit": 8000
  }')

echo "$CAPSULE_RESPONSE" | jq . 2>/dev/null || echo "$CAPSULE_RESPONSE"
echo ""

# Check if Dash anchoring worked
if echo "$CAPSULE_RESPONSE" | grep -q '"dash":null'; then
    echo -e "${RED}⚠️  Dash anchoring failed (dash: null)${NC}"
    echo "   Check that DASH_CONTRACT_ID is set in .env"
else
    echo -e "${GREEN}✅ Dash anchoring successful!${NC}"
fi
echo ""

echo -e "${BLUE}4️⃣ Getting capsule...${NC}"
GET_CAPSULE=$(curl -s -X GET http://localhost:4000/api/capsule \
  -H "Authorization: Bearer $TOKEN")

echo "$GET_CAPSULE" | jq . 2>/dev/null || echo "$GET_CAPSULE"
echo ""

echo -e "${BLUE}5️⃣ Testing transaction...${NC}"
TXN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/txn/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "merchant": "Whole Foods",
    "mcc": "GROCERY",
    "amount": 50,
    "deviceId": "laptop-123",
    "geo": "San Francisco",
    "pd": 0.03
  }')

echo "$TXN_RESPONSE" | jq . 2>/dev/null || echo "$TXN_RESPONSE"
echo ""

# ============================================
# TEST 2: Emergency Capsule
# ============================================
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚨 TEST 2: Emergency Capsule${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo ""

# First, close the regular capsule to create emergency one
echo -e "${BLUE}6️⃣ Closing regular capsule...${NC}"
CLOSE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/capsule/close \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "$CLOSE_RESPONSE" | jq . 2>/dev/null || echo "$CLOSE_RESPONSE"
echo ""

# Get emergency types
echo -e "${BLUE}7️⃣ Getting available emergency types...${NC}"
EMERGENCY_TYPES=$(curl -s -X GET http://localhost:4000/api/capsule/emergency-types \
  -H "Authorization: Bearer $TOKEN")

echo "$EMERGENCY_TYPES" | jq . 2>/dev/null || echo "$EMERGENCY_TYPES"
echo ""

# Create emergency capsule
echo -e "${BLUE}8️⃣ Creating emergency capsule (HEALTH_CRISIS)...${NC}"
EMERGENCY_RESPONSE=$(curl -s -X POST http://localhost:4000/api/capsule/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "EMERGENCY",
    "emergencyType": "HEALTH_CRISIS",
    "verificationDoc": "emergency_doc_12345",
    "verificationStatus": "approved",
    "allowedMcc": ["GROCERY", "MEDICAL", "PHARMACY"],
    "maxTransaction": 500,
    "dailyCap": 1000,
    "capsuleLimit": 500
  }')

echo "$EMERGENCY_RESPONSE" | jq . 2>/dev/null || echo "$EMERGENCY_RESPONSE"
echo ""

# Check emergency status
echo -e "${BLUE}9️⃣ Checking emergency status...${NC}"
EMERGENCY_STATUS=$(curl -s -X GET http://localhost:4000/api/capsule/emergency-status \
  -H "Authorization: Bearer $TOKEN")

echo "$EMERGENCY_STATUS" | jq . 2>/dev/null || echo "$EMERGENCY_STATUS"
echo ""

# Test transaction on emergency capsule
echo -e "${BLUE}🔟 Testing transaction on emergency capsule...${NC}"
EMERGENCY_TXN=$(curl -s -X POST http://localhost:4000/api/txn/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "merchant": "CVS Pharmacy",
    "mcc": "PHARMACY",
    "amount": 100,
    "deviceId": "laptop-123",
    "geo": "San Francisco",
    "pd": 0.03,
    "faceToken": "face-scan-123",
    "otp": "123456"
  }')

echo "$EMERGENCY_TXN" | jq . 2>/dev/null || echo "$EMERGENCY_TXN"
echo ""

# Close emergency capsule
echo -e "${BLUE}1️⃣1️⃣ Closing emergency capsule...${NC}"
CLOSE_EMERGENCY=$(curl -s -X POST http://localhost:4000/api/capsule/close \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "$CLOSE_EMERGENCY" | jq . 2>/dev/null || echo "$CLOSE_EMERGENCY"
echo ""

# ============================================
# SUMMARY
# ============================================
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ TEST SUMMARY${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
echo ""

# Check results
if echo "$CAPSULE_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Regular capsule creation: PASSED${NC}"
else
    echo -e "${RED}❌ Regular capsule creation: FAILED${NC}"
fi

if echo "$CAPSULE_RESPONSE" | grep -q '"dash":null'; then
    echo -e "${YELLOW}⚠️  Dash anchoring: NOT WORKING (check .env)${NC}"
else
    echo -e "${GREEN}✅ Dash anchoring: WORKING${NC}"
fi

if echo "$TXN_RESPONSE" | grep -q '"approved":true'; then
    echo -e "${GREEN}✅ Transaction approval: PASSED${NC}"
else
    echo -e "${RED}❌ Transaction approval: FAILED${NC}"
fi

if echo "$EMERGENCY_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ Emergency capsule creation: PASSED${NC}"
else
    echo -e "${RED}❌ Emergency capsule creation: FAILED${NC}"
fi

if echo "$EMERGENCY_TXN" | grep -q '"approved":true'; then
    echo -e "${GREEN}✅ Emergency transaction: PASSED${NC}"
else
    echo -e "${RED}❌ Emergency transaction: FAILED${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Test complete!${NC}"