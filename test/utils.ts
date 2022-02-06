import { ethers, BigNumber } from "ethers";

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

interface SafeTx {
    to: string,
    value: BigNumber | number | string,
    data: string,
    operation: number,
    safeTxGas: number | string,
    baseGas: number | string,
    gasPrice: number | string,
    gasToken: string,
    refundReceiver: string,
    signature: string
}

export const safeTx = (_to: string, _value: BigNumber | number | string, _data: string, _operation: number, _safeTxGas: number | string,
    _baseGas: number | string, _gasPrice: number | string, _gasToken: string, _refundReceiver: string, _signature: string): SafeTx => {

    return {
        to: _to,
        value: _value,
        data: _data,
        operation: _operation,
        safeTxGas: _safeTxGas,
        baseGas: _baseGas,
        gasPrice: _gasPrice,
        gasToken: _gasToken,
        refundReceiver: _refundReceiver,
        signature: _signature
    };
}

export const singletonAbi = ["function setup(address[] calldata _owners,uint256 _threshold)"];

export const erc20Abi = ["function approve(address spender, uint rawAmount) external returns (bool)", "function balanceOf(address account) external view returns (uint)", "function transfer(address dst, uint rawAmount) external returns (bool)", "function balanceOfUnderlying(address account) external view returns (uint)", "function borrowBalanceCurrent(address account) external view returns (uint256)", "function totalSupply() external view returns (uint256)", "function name() external view returns (string memory)"];

export const VERSION = "0.0.1"; // Beta version.

export const addressZero = ethers.constants.AddressZero;
