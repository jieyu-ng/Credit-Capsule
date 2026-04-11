import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import { authRouter } from "./routes/auth.js";
import { capsuleRouter } from "./routes/capsule.js";
import { riskRouter } from "./routes/risk.js";
import { txnRouter } from "./routes/txn.js";
import { auditRouter } from "./routes/audit.js";
import { dashAuthRouter } from "./routes/dashAuth.js";


dotenv.config();


console.log('🔍 ===== SERVER ENVIRONMENT =====');
console.log('DASH_CONTRACT_ID:', process.env.DASH_CONTRACT_ID || '❌ MISSING');
console.log('DASH_IDENTITY_ID:', process.env.DASH_IDENTITY_ID || '❌ MISSING');
console.log('DASH_NETWORK:', process.env.DASH_NETWORK || '❌ MISSING');
console.log('================================\n');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/risk", riskRouter);
app.use("/api/capsule", capsuleRouter);
app.use("/api/txn", txnRouter);
app.use("/api/audit", auditRouter);
app.use("/api/dash", dashAuthRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));