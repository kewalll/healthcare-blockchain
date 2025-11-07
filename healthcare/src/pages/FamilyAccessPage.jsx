import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlockchain } from '../context/BlockchainContext';
import FamilyAccess from '../components/FamilyAccess';
import FamilyViewer from "../components/FamilyViewer";
import Navbar from '../components/Navbar';

export default function FamilyAccessPage() {
  const { account, isLoading } = useBlockchain();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black to-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black to-gray-900">
        <Navbar />
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-[#1A1A1A] p-6 rounded-lg shadow-xl border border-[#2A2A2A]">
            <h2 className="text-2xl font-bold mb-4 text-white">Please connect your wallet</h2>
            <p className="mb-4 text-gray-400">You need to connect your wallet to manage family access.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-green-500 text-black rounded-full hover:bg-green-600 transition font-medium"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-gray-900">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <FamilyAccess />
          <FamilyViewer />
        </div>
      </div>
    </div>
  );
}