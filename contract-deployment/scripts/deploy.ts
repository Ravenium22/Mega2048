import { ethers } from "hardhat";

async function main() {
  console.log("Deploying MEGAETH 2048 contract...");

 
  const Board = await ethers.getContractFactory("Board");
  const board = await Board.deploy();
  
  await board.waitForDeployment();
  
  const boardAddress = await board.getAddress();
  console.log(`Board library deployed to: ${boardAddress}`);

  
  const MEGAETH2048 = await ethers.getContractFactory("MEGAETH2048", {
    libraries: {
      Board: boardAddress,
    },
  });
  
  const game = await MEGAETH2048.deploy();
  await game.waitForDeployment();
  
  const gameAddress = await game.getAddress();
  console.log(`MEGAETH2048 deployed to: ${gameAddress}`);

  
  console.log("Waiting for deployment confirmation...");
  await new Promise(resolve => setTimeout(resolve, 10000)); 
  
  console.log("Deployment confirmed!");

  console.log("\n=== Deployment Summary ===");
  console.log(`Board Library: ${boardAddress}`);
  console.log(`MEGAETH2048 Game: ${gameAddress}`);
  console.log("=========================\n");

  console.log("Don't forget to update the contract address in constants.ts:");
  console.log(`export const MEGAETH_GAME_CONTRACT_ADDRESS = "${gameAddress}";`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
  