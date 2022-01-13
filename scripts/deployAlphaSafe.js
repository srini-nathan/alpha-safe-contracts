async function main() {

    // Deploy Alpha Safe
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const ALPHA_SAFE = await ethers.getContractFactory("AlphaSafe");
    const AlphaSafe = await ALPHA_SAFE.deploy();
    console.log("AlphaSafe address -->", AlphaSafe.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });






