import { BigNumber, providers, utils } from 'ethers'
import { addDefaultLocalNetwork } from '@arbitrum/sdk'
import { NodeInterface__factory } from '@arbitrum/sdk/dist/lib/abi/factories/NodeInterface__factory'
import { NODE_INTERFACE_ADDRESS } from '@arbitrum/sdk/dist/lib/dataEntities/constants'
import { Provider } from '@ethersproject/providers'

/**
 * Calculate gas price in arb network
 * @param destinationAddress 
 * @param txData 
 * @param gasLimit 
 * @param arbProvider 
 * @returns 
 */
const destinationAddress = '0x1234563d5de0d7198451f87bcbf15aefd00d434d'
export const gasEstimator = async (
    txData: string,
    gasLimit: BigNumber,
    arbProvider: string | Provider
) => {
    try{
        addDefaultLocalNetwork()
    }catch{}
    
    const baseL2Provider = typeof(arbProvider) === 'string'? new providers.StaticJsonRpcProvider(arbProvider): arbProvider

    // Instantiation of the NodeInterface object
    const nodeInterface = NodeInterface__factory.connect(NODE_INTERFACE_ADDRESS, baseL2Provider)

    // Getting the estimations from NodeInterface.GasEstimateComponents()
    // ------------------------------------------------------------------
    const gasEstimateComponents = await nodeInterface.callStatic.gasEstimateComponents(
        destinationAddress,
        false,
        txData,
        {
            blockTag: 'latest',
        }
    )

    // Getting useful values for calculating the formula
    const l1GasEstimated = gasEstimateComponents.gasEstimateForL1
    const l2GasUsed = gasEstimateComponents.gasEstimate.sub(gasEstimateComponents.gasEstimateForL1)
    const l2EstimatedPrice = gasEstimateComponents.baseFee
    let l1EstimatedPrice = gasEstimateComponents.l1BaseFeeEstimate.mul(16)

    // Calculating some extra values to be able to apply all variables of the formula
    // -------------------------------------------------------------------------------
    // NOTE: This one might be a bit confusing, but l1GasEstimated (B in the formula) is calculated based on l2 gas fees
    // del const l1Cost = l1GasEstimated.mul(l2EstimatedPrice)
    // NOTE: This is similar to 140 + utils.hexDataLength(txData);
    // del const l1Size = l1Cost.div(l1EstimatedPrice)
    const l1Size = utils.hexDataLength(txData) + 140

    // Getting the result of the formula
    // ---------------------------------
    // Setting the basic variables of the formula
    const P = l2EstimatedPrice
    const L2G = l2GasUsed
    const L1P = l1EstimatedPrice
    const L1S = l1Size

    // L1C (L1 Cost) = L1P * L1S
    const L1C = L1P.mul(L1S)

    // B (Extra Buffer) = L1C / P
    const B = L1C.div(P)

    // G (Gas Limit) = L2G + B
    const G = L2G.add(B)

    // TXFEES (Transaction fees) = P * G
    const TXFEES = P.mul(G)

    console.log(`Transaction estimated fees to pay = ${utils.formatEther(TXFEES)} ETH`)
    console.log(gasLimit.toNumber())
    return TXFEES.div(gasLimit)
}