const hre = require("hardhat");

async function main() {
  const AuditLog = await hre.ethers.getContractFactory("AuditLog");
  const audit = await AuditLog.deploy();
  await audit.waitForDeployment();
  console.log("AuditLog deployed to:", await audit.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});