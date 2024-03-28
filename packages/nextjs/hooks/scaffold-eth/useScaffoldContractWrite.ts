import { useState } from "react";
import { useTargetNetwork } from "./useTargetNetwork";
import { MutateOptions } from "@tanstack/react-query";
import { Abi, ExtractAbiFunctionNames } from "abitype";
import { Config, UseWriteContractParameters, useAccount, useWriteContract } from "wagmi";
import { WriteContractErrorType, WriteContractReturnType } from "wagmi/actions";
import { WriteContractVariables } from "wagmi/query";
import { useDeployedContractInfo, useTransactor } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import {
  ContractAbi,
  ContractName,
  scaffoldWriteContractOptions,
  scaffoldWriteContractVariables,
} from "~~/utils/scaffold-eth/contract";

/**
 * Wrapper around wagmi's useWriteContract hook which automatically loads (by name) the contract ABI and address from
 * the contracts present in deployedContracts.ts & externalContracts.ts corresponding to targetNetworks configured in scaffold.config.ts
 * @param contractName - contract name
 * @param writeContractParams - wagmi's useWriteContract parameters
 */
export const useScaffoldWriteContract = <TContractName extends ContractName>(
  contractName: TContractName,
  writeContractParams?: UseWriteContractParameters,
) => {
  const { data: deployedContractData } = useDeployedContractInfo(contractName);
  const { chain } = useAccount();
  const writeTx = useTransactor();
  const [isMining, setIsMining] = useState(false);
  const { targetNetwork } = useTargetNetwork();

  const wagmiContractWrite = useWriteContract(writeContractParams);

  const sendContractWriteTx = async <
    TFunctionName extends ExtractAbiFunctionNames<ContractAbi<TContractName>, "nonpayable" | "payable">,
  >(
    variables: scaffoldWriteContractVariables<TContractName, TFunctionName>,
    options?: scaffoldWriteContractOptions,
  ) => {
    if (!deployedContractData) {
      notification.error("Target Contract is not deployed, did you forget to run `yarn deploy`?");
      return;
    }
    if (!chain?.id) {
      notification.error("Please connect your wallet");
      return;
    }
    if (chain?.id !== targetNetwork.id) {
      notification.error("You are on the wrong network");
      return;
    }

    try {
      setIsMining(true);
      const makeWriteWithParams = () =>
        wagmiContractWrite.writeContractAsync(
          {
            abi: deployedContractData.abi as Abi,
            address: deployedContractData.address,
            ...variables,
          } as WriteContractVariables<Abi, string, any[], Config, number>,
          options as
            | MutateOptions<
                WriteContractReturnType,
                WriteContractErrorType,
                WriteContractVariables<Abi, string, any[], Config, number>
              >
            | undefined,
        );
      const writeTxResult = await writeTx(makeWriteWithParams);

      return writeTxResult;
    } catch (e: any) {
      throw e;
    } finally {
      setIsMining(false);
    }
  };
  return {
    ...wagmiContractWrite,
    isMining,
    // Overwrite wagmi's write async
    writeContractAsync: sendContractWriteTx,
  };
};
