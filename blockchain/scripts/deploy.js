const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Healthcare contract with optimizations...");
  
  // Get the contract factory
  const Healthcare = await ethers.getContractFactory("Healthcare");
  
  try {
    // Deploy with increased gas limit and gas price
    const healthcare = await Healthcare.deploy({
      gasLimit: 8000000,
      gasPrice: ethers.parseUnits("20", "gwei")
    });
    
    // Wait for deployment to complete
    console.log("Waiting for deployment transaction...");
    await healthcare.waitForDeployment();
    
    const address = await healthcare.getAddress();
    console.log("Healthcare contract deployed to:", address);
    
    // Verify the deployment by calling a simple function
    try {
      const role = await healthcare.getRole(await healthcare.runner.getAddress());
      console.log("Deployment verified. Admin role:", role);
    } catch (error) {
      console.log("Deployment successful but verification failed:", error.message);
    }
    
    return healthcare;
    
  } catch (error) {
    console.error("Deployment failed:", error.message);
    
    // If deployment fails due to gas estimation, try with manual gas limit
    if (error.message.includes("execution failed") || error.message.includes("gas")) {
      console.log("Retrying with manual gas configuration...");
      
      try {
        const healthcare = await Healthcare.deploy({
          gasLimit: 6000000, // Reduced gas limit
          gasPrice: ethers.parseUnits("10", "gwei") // Lower gas price
        });
        
        await healthcare.waitForDeployment();
        const address = await healthcare.getAddress();
        console.log("Healthcare contract deployed to:", address);
        return healthcare;
        
      } catch (retryError) {
        console.error("Retry deployment also failed:", retryError.message);
        throw retryError;
      }
    }
    
    throw error;
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment script failed:", error);
    process.exit(1);
  });