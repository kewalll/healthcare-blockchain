// FamilyAccess.jsx
import React, { useState, useEffect } from 'react';
import { useBlockchain } from '../context/BlockchainContext';

/** ---------- Small helpers ---------- **/
const toDateStringFromSec = (v) => {
  // ethers v6 often returns uints as BigInt
  if (v == null) return '-';
  const seconds = typeof v === 'bigint' ? Number(v) : Number(v);
  if (Number.isNaN(seconds)) return '-';
  return new Date(seconds * 1000).toLocaleDateString();
};

const shortAddr = (addr) => {
  if (!addr || typeof addr !== 'string') return '';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

/** ---------- Optional: Error Boundary ---------- **/
class FamilyAccessErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong.' };
  }
  componentDidCatch(error, info) {
    // You can log this to your monitoring
    // console.error('FamilyAccess crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto p-6 bg-[#1A1A1A] rounded-lg shadow-xl border border-[#2A2A2A]">
          <h2 className="text-2xl font-bold mb-4 text-white">Family Access Management</h2>
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 text-red-300 rounded">
            {this.state.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** ---------- Main Component ---------- **/
function FamilyAccessInner() {
  const {
    account,
    familyMembers = [],
    isLoading = false,
    grantFamilyAccess,
    revokeFamilyAccess,
    loadFamilyMembers,
  } = useBlockchain();

  const [newMemberAddress, setNewMemberAddress] = useState('');
  const [relationship, setRelationship] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (account && typeof loadFamilyMembers === 'function') {
      // Fire and forget
      loadFamilyMembers().catch((e) => {
        console.error('Failed to load family members:', e);
        setError('Failed to load family members.');
      });
    }
  }, [account, loadFamilyMembers]);

  const clearFlash = () => {
    window.setTimeout(() => {
      setSuccess('');
      setError('');
    }, 5000);
  };

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    if (!newMemberAddress || !relationship || !passcode) {
      setError('Please fill in all fields');
      clearFlash();
      return;
    }
    if (!account) {
      setError('Please connect your wallet');
      clearFlash();
      return;
    }
    try {
      await grantFamilyAccess(newMemberAddress.trim(), relationship.trim(), passcode);
      setSuccess('Access granted successfully');
      setNewMemberAddress('');
      setRelationship('');
      setPasscode('');
    } catch (err) {
      console.error('Error granting access:', err);
      setError(err?.message || 'Failed to grant access. Please check the address and try again.');
    } finally {
      clearFlash();
    }
  };

  const handleRevokeAccess = async (memberAddress) => {
    if (!window.confirm('Are you sure you want to revoke access?')) return;

    if (!account) {
      setError('Please connect your wallet');
      clearFlash();
      return;
    }

    try {
      const confirmPasscode = prompt('Please enter your passcode to confirm:');
      if (!confirmPasscode) return;

      await revokeFamilyAccess(memberAddress, confirmPasscode);
      setSuccess('Access revoked successfully');
    } catch (err) {
      console.error('Error revoking access:', err);
      setError(err?.message || 'Failed to revoke access. Please try again.');
    } finally {
      clearFlash();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-[#1A1A1A] rounded-lg shadow-xl border border-[#2A2A2A]">
      <h2 className="text-2xl font-bold mb-6 text-white">Family Access Management</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 text-red-300 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500 text-green-300 rounded">
          {success}
        </div>
      )}

      {/* Grant Access */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-white">Grant Access to Family Member</h3>
        <form onSubmit={handleGrantAccess} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Family Member&apos;s Wallet Address
            </label>
            <input
              type="text"
              value={newMemberAddress}
              onChange={(e) => setNewMemberAddress(e.target.value)}
              className="w-full p-2 bg-[#2A2A2A] text-white border border-[#444] rounded-md focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="0x..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Relationship</label>
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full p-2 bg-[#2A2A2A] text-white border border-[#444] rounded-md focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="e.g., Spouse, Parent, Child"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Your Passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full p-2 bg-[#2A2A2A] text-white border border-[#444] rounded-md focus:ring-green-500 focus:border-green-500 transition-colors"
              placeholder="Enter your passcode"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-green-500 text-black rounded-full hover:bg-green-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Grant Access'}
          </button>
        </form>
      </div>

      {/* List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-white">Family Members with Access</h3>
        {isLoading && familyMembers.length === 0 ? (
          <p className="text-gray-400">Loading family members...</p>
        ) : familyMembers.length === 0 ? (
          <p className="text-gray-500">No family members have been granted access yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#2A2A2A]">
              <thead className="bg-[#2A2A2A]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Relationship
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Access Granted On
                  </th>
                  
                </tr>
              </thead>
              <tbody className="bg-[#1A1A1A] divide-y divide-[#2A2A2A]">
                {familyMembers.map((member, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {shortAddr(member?.memberAddress)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {member?.relationship ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {toDateStringFromSec(member?.accessGrantedAt)}
                    </td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** ---------- Export with Error Boundary ---------- **/
export default function FamilyAccess() {
  return (
    <FamilyAccessErrorBoundary>
      <FamilyAccessInner />
    </FamilyAccessErrorBoundary>
  );
}
