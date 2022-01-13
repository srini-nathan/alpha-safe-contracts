async function main() {

    // Deploy Alpha Safe
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const ALPHA_SAFE_PROXY_FACTORY = await ethers.getContractFactory("AlphaSafeProxyFactory");
    const AlphaSafeProxyFactory = await ALPHA_SAFE_PROXY_FACTORY.deploy();
    console.log("AlphaSafeProxyFactory address -->", AlphaSafeProxyFactory.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
