import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import HealthcareABI from "../contracts/HealthcareABI.json";

// Helper function to format address
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(38)}`;
};

// Custom error class for blockchain operations
class BlockchainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
  }
}

const BlockchainContext = createContext();

export const BlockchainProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [contract, setContract] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [familyMembers, setFamilyMembers] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadBlockchainData = async () => {
            if (window.ethereum) {
                const provider = new BrowserProvider(window.ethereum); // ✅ Use BrowserProvider
                const signer = await provider.getSigner();
                const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS; // Store in .env

                const contractInstance = new Contract(contractAddress, HealthcareABI, signer); // ✅ Use Contract from ethers

                setContract(contractInstance);

                const accounts = await window.ethereum.request({ method: "eth_accounts" });
                if (accounts.length > 0) setAccount(accounts[0]);
            }
        };

        loadBlockchainData();
    }, []);

    const connectWallet = async () => {
        if (!window.ethereum) {
            throw new BlockchainError('MetaMask not detected', 'NO_METAMASK');
        }
        
        try {
            setIsLoading(true);
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            setAccount(accounts[0]);
            return accounts[0];
        } catch (err) {
            console.error('Error connecting wallet:', err);
            throw new BlockchainError(
                err.message || 'Failed to connect wallet',
                err.code || 'WALLET_CONNECTION_ERROR'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Load family members with access to the current account's data
    const loadFamilyMembers = useCallback(async () => {
        if (!contract || !account) return;
        
        try {
            setIsLoading(true);
            const members = await contract.getFamilyMembers();
            setFamilyMembers(members);
            return members;
        } catch (err) {
            console.error('Error loading family members:', err);
            setError('Failed to load family members');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [contract, account]);

    // Grant family access to another address
    const grantFamilyAccess = async (familyAddress, relationship, passcode) => {
        if (!contract) {
            throw new BlockchainError('Contract not connected', 'CONTRACT_NOT_CONNECTED');
        }
        
        try {
            setIsLoading(true);
            const tx = await contract.grantFamilyAccess(
                familyAddress,
                relationship,
                passcode,
                { gasLimit: 300000 } // Add gas limit to prevent out of gas errors
            );
            await tx.wait();
            await loadFamilyMembers(); // Refresh the family members list
            return tx;
        } catch (err) {
            console.error('Error granting family access:', err);
            throw new BlockchainError(
                err.reason || 'Failed to grant family access',
                err.code || 'FAMILY_ACCESS_ERROR'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Revoke family access from an address
    const revokeFamilyAccess = async (familyAddress, passcode) => {
        if (!contract) {
            throw new BlockchainError('Contract not connected', 'CONTRACT_NOT_CONNECTED');
        }
        
        try {
            setIsLoading(true);
            const tx = await contract.revokeFamilyAccess(familyAddress, passcode, {
                gasLimit: 200000
            });
            await tx.wait();
            await loadFamilyMembers(); // Refresh the family members list
            return tx;
        } catch (err) {
            console.error('Error revoking family access:', err);
            throw new BlockchainError(
                err.reason || 'Failed to revoke family access',
                err.code || 'REVOKE_ACCESS_ERROR'
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Check if an address has access to the current account's data
    const hasAccess = async (patientAddress, requesterAddress) => {
        if (!contract) return false;
        
        try {
            return await contract.hasAccess(patientAddress, requesterAddress);
        } catch (err) {
            console.error('Error checking access:', err);
            return false;
        }
    };

    // Load family members when account or contract changes
    useEffect(() => {
        if (contract && account) {
            loadFamilyMembers();
        }
    }, [contract, account, loadFamilyMembers]);

    return (
        <BlockchainContext.Provider 
            value={{
                // State
                account,
                contract,
                isLoading,
                familyMembers,
                error,
                
                // Methods
                connectWallet,
                grantFamilyAccess,
                revokeFamilyAccess,
                hasAccess,
                loadFamilyMembers,
                formatAddress,
                
                // Constants
                isConnected: !!account,
                isPatient: !!account, // You might want to implement proper role checking
            }}
        >
            {children}
        </BlockchainContext.Provider>
    );
};

export const useBlockchain = () => useContext(BlockchainContext);
