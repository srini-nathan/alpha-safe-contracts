import { ethers } from "ethers";

export const encodeFunctionData = (abi: any, functionName: string, ..._params: any[]): string => {
    const params = _params[0]; //Eliminating one array layer.
    const iface = new ethers.utils.Interface(abi);
    const data = iface.encodeFunctionData(functionName, params);
    return data;
}

export const executorSignature = (_address: string): string => {
    const address = _address.slice(2,);
    const signatureVerifier = "000000000000000000000000" + address;
    const dataPosition = "00000000000000000000000000000000000000000000000000000000000000000";
    const signatureType = "1";
    const signature = signatureVerifier + dataPosition + signatureType;
    return signature;
}

export const singletonAbi = ["function setup(address[] calldata _owners,uint256 _threshold)"];
export const erc20Abi = ["function approve(address spender, uint rawAmount) external returns (bool)", "function balanceOf(address account) external view returns (uint)", "function transfer(address dst, uint rawAmount) external returns (bool)", "function balanceOfUnderlying(address account) external view returns (uint)"];

export const VERSION = "0.0.1"; // Beta version.
