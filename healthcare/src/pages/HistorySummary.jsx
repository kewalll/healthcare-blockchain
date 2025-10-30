import { useState } from "react";
import { useBlockchain } from "../context/BlockchainContext";
import ReactMarkdown from "react-markdown";

const HistorySummary = () => {
    const { contract } = useBlockchain();
    const [walletAddress, setWalletAddress] = useState("");
    const [passcode, setPasscode] = useState("");
    const [patient, setPatient] = useState(null);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [summary, setSummary] = useState(null);

    const calculateAge = (dob) => {
        const birthDate = new Date(dob);
        const today = new Date();
        return today.getFullYear() - birthDate.getFullYear();
    };

    const fetchPatientData = async () => {
        if (!walletAddress) {
            setError("Enter wallet address!");
            return;
        }

        setLoading(true);
        setError("");
        setPatient(null);
        setSummary(null);

        try {
            let patientData;

            if (
                walletAddress.toLowerCase() ===
                window.ethereum?.selectedAddress?.toLowerCase()
            ) {
                const data = await contract.patients(walletAddress);
                patientData = {
                    fullName: data.fullName,
                    dob: data.dob,
                    addressDetails: data.addressDetails,
                    contactNumber: data.contactNumber,
                    allergies: data.allergies,
                    weight: Number(data.weight),
                    height: Number(data.height),
                };
            } else {
                const data = await contract.getPatientDetailsWithPasscode(
                    walletAddress,
                    passcode
                );
                patientData = {
                    fullName: data[0],
                    dob: data[1],
                    addressDetails: data[2],
                    contactNumber: data[3],
                    allergies: data[4],
                    weight: Number(data[5]),
                    height: Number(data[6]),
                };
            }

            setPatient({
                ...patientData,
                age: calculateAge(patientData.dob),
            });

            const caseIds = await contract.getCaseIdsForPatient(walletAddress);
            const caseDetails = await Promise.all(
                caseIds.map(async (id) => {
                    const c = await contract.getCaseDetails(Number(id));
                    return {
                        caseId: Number(c[0]),
                        caseTitle: c[3],
                        isOngoing: c[2],
                        recordIds: c[4],
                        reportCIDs: c[5],
                    };
                })
            );

            setCases(caseDetails);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch patient data. " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGetSummary = async () => {
        try {
            setLoading(true);
            setSummary(null);
            setError("");

            const caseTitles = cases.map((c) => c.caseTitle);

            const response = await fetch("http://localhost:8003/summarizer", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ caseTitles }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            setSummary(data.summary);
        } catch (err) {
            console.error("Error getting summary:", err);
            setError("Failed to get summary. Please check backend connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Wallet + Passcode Input */}
                {!patient && (
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 shadow-lg">
                        <h2 className="text-2xl font-bold text-center text-teal-400 mb-4">
                            Patient Summary Portal
                        </h2>

                        <div className="space-y-3 mb-4">
                            <input
                                type="text"
                                placeholder="Enter Wallet Address"
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-teal-500"
                            />
                            <input
                                type="password"
                                placeholder="Enter Passcode (if needed)"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                className="w-full p-3 bg-gray-900 border border-gray-700 rounded-md focus:ring-2 focus:ring-teal-500"
                            />
                            <button
                                onClick={fetchPatientData}
                                className="w-full bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-md transition"
                                disabled={loading}
                            >
                                {loading ? "Fetching..." : "Fetch Patient Details"}
                            </button>
                        </div>


                        {error && <p className="text-red-400 text-center">{error}</p>}
                    </div>
                )}

                {/* Display Patient Info */}
                {patient && (
                    <div className="mt-6 bg-gray-800/50 p-6 rounded-xl border border-gray-700 shadow-lg">
                        <h3 className="text-xl font-semibold text-teal-400 mb-4">
                            Patient Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-700/30 p-3 rounded-lg">
                                <p className="text-sm text-gray-400">Full Name</p>
                                <p className="font-medium">{patient.fullName}</p>
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg">
                                <p className="text-sm text-gray-400">Age</p>
                                <p className="font-medium">{patient.age}</p>
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg">
                                <p className="text-sm text-gray-400">Contact</p>
                                <p className="font-medium">{patient.contactNumber}</p>
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg">
                                <p className="text-sm text-gray-400">Address</p>
                                <p className="font-medium">{patient.addressDetails}</p>
                            </div>
                            <div className="bg-gray-700/30 p-3 rounded-lg col-span-2">
                                <p className="text-sm text-gray-400">Allergies</p>
                                <p className="font-medium">{patient.allergies || "None"}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleGetSummary}
                            className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-md transition"
                            disabled={loading}
                        >
                            {loading ? "Generating Summary..." : "Get Summary"}
                        </button>
                    </div>
                )}

                {/* Display Summary */}
                {summary && (
                    <div className="mt-6 bg-gray-800/50 p-6 rounded-xl border border-gray-700 shadow-lg">
                        <h3 className="text-xl font-semibold text-teal-400 mb-4">
                            Patient Summary
                        </h3>
                        <p className="text-gray-300 ">
                            <ReactMarkdown>{summary}</ReactMarkdown>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistorySummary;
