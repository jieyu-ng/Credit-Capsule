
echo "🚀 Complete Test Flow"
echo "====================="
echo ""

# 1. Register
echo "1️⃣ Registering user..."
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
echo "2️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "test123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 3. Create capsule
echo "3️⃣ Creating capsule..."
CAPSULE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/capsule/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "allowedMcc": ["GROCERY", "FUEL"],
    "maxTransaction": 1000,
    "dailyCap": 5000,
    "capsuleLimit": 8000
  }')

echo "$CAPSULE_RESPONSE" | jq . 2>/dev/null || echo "$CAPSULE_RESPONSE"
echo ""

# 4. Get capsule
echo "4️⃣ Getting capsule..."
GET_CAPSULE=$(curl -s -X GET http://localhost:4000/api/capsule \
  -H "Authorization: Bearer $TOKEN")

echo "$GET_CAPSULE" | jq . 2>/dev/null || echo "$GET_CAPSULE"
echo ""

# 5. Test transaction
echo "5️⃣ Testing transaction..."
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

echo "✅ Test complete!"