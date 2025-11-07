// src/components/FamilyViewer.jsx
import React, { useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { useBlockchain } from "../context/BlockchainContext";
import healthcareAbi from "../contracts/HealthcareABI.json";

// ENV: .env must have VITE_CONTRACT_ADDRESS=0xYourDeployedAddress
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Helpers
const shortAddr = (a) => (a && a.length > 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a || "");
const toNum = (v) => (typeof v === "bigint" ? Number(v) : Number(v));
const isEthAddress = (a) => {
  try { return ethers.isAddress(a); } catch { return false; }
};

export default function FamilyViewer() {
  const ctx = useBlockchain?.() || {};
  const { account, contract: ctxContract, isLoading: ctxLoading } = ctx;

  const [patientAddr, setPatientAddr] = useState("");
  const [cases, setCases] = useState([]);        // [{caseId, title}]
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [records, setRecords] = useState([]);    // normalized structs
  const [reports, setReports] = useState([]);    // string[]
  const [access, setAccess] = useState(null);    // true/false/null
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const roContractRef = useRef(null);

  // Make or reuse a read-only contract
  const getContract = useMemo(() => {
    return async () => {
      if (ctxContract?.getCaseDetails && ctxContract?.records) {
        return ctxContract;
      }
      if (!CONTRACT_ADDRESS) {
        throw new Error("VITE_CONTRACT_ADDRESS is not set in .env");
      }
      if (roContractRef.current) return roContractRef.current;

      let provider;
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        provider = ethers.getDefaultProvider(); // replace with your RPC if you prefer
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, healthcareAbi, await provider);
      roContractRef.current = contract;
      return contract;
    };
  }, [ctxContract]);

  const resetAll = () => {
    setCases([]);
    setActiveCaseId(null);
    setRecords([]);
    setReports([]);
  };

  const resetCaseState = () => {
    setActiveCaseId(null);
    setRecords([]);
    setReports([]);
  };

  const mustCheckAccess = async (contract, patient, requester) => {
    // Hard-enforce access using the contract's mapping
    const ok = await contract.hasAccess(patient, requester);
    setAccess(Boolean(ok));
    if (!ok) {
      resetAll();
      throw new Error("Access denied by patient. You are not authorized to view their cases.");
    }
  };

  const checkAccess = async () => {
    setErr("");
    setAccess(null);

    if (!isEthAddress(patientAddr)) {
      setErr("Please enter a valid patient address (0x…).");
      return;
    }
    if (!account) {
      setErr("Please connect your wallet to check and view access.");
      return;
    }
    try {
      const c = await getContract();
      await mustCheckAccess(c, patientAddr, account);
      // If no error thrown, you have access
    } catch (e) {
      console.error(e);
      setErr(e.shortMessage || e.message || "Failed to check access.");
    }
  };

  const fetchCases = async () => {
    setErr("");
    setAccess(null);

    if (!isEthAddress(patientAddr)) {
      setErr("Please enter a valid patient address (0x…).");
      return;
    }
    if (!account) {
      setErr("Please connect your wallet. Viewing requires authorization by the patient.");
      return;
    }

    setBusy(true);
    try {
      const c = await getContract();

      // ⛔ Enforce access BEFORE any data fetch
      await mustCheckAccess(c, patientAddr, account);

      // 1) case IDs for the patient
      const ids = await c.getCaseIdsForPatient(patientAddr);
      const caseIds = ids.map(toNum);

      // 2) case titles via getCaseDetails
      const details = await Promise.all(caseIds.map((id) => c.getCaseDetails(id)));
      const list = details.map((x) => ({
        caseId: toNum(x[0]),
        patient: x[1],
        isOngoing: x[2],
        caseTitle: x[3],
        recordIds: x[4].map(toNum),
        reportCIDs: x[5],
      }));

      setCases(list.map(({ caseId, caseTitle }) => ({ caseId, title: caseTitle })));
      resetCaseState();

      if (list.length === 0) setErr("No cases found for this patient.");
    } catch (e) {
      console.error(e);
      setErr(e.shortMessage || e.message || "Failed to load cases.");
    } finally {
      setBusy(false);
    }
  };

  const openCase = async (caseId) => {
    setErr("");
    setBusy(true);
    try {
      const c = await getContract();

      // ⛔ Re-check access (defense in depth)
      await mustCheckAccess(c, patientAddr, account);

      const d = await c.getCaseDetails(caseId);
      const recordIds = d[4].map(toNum);
      const reportCIDs = d[5];

      const recs = await Promise.all(recordIds.map((rid) => c.records(rid)));
      const normalized = recs.map((r) => ({
        recordId: toNum(r.recordId),
        caseId: toNum(r.caseId),
        doctor: r.doctor,
        symptoms: r.symptoms,
        cause: r.cause,
        inference: r.inference,
        prescription: r.prescription,
        advices: r.advices,
        medications: r.medications,
      }));

      setActiveCaseId(caseId);
      setRecords(normalized);
      setReports(reportCIDs);
    } catch (e) {
      console.error(e);
      setErr(e.shortMessage || e.message || "Failed to load case details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 max-w-5xl mx-auto p-6 bg-[#111] text-white rounded-lg border border-[#2A2A2A]">
      <h2 className="text-2xl font-bold mb-2">Family Viewer (Read-Only + Enforced Access)</h2>
      <p className="text-sm text-gray-400 mb-6">
        Enter the patient&apos;s address. You must be granted access on-chain to view any data.
      </p>

      {!account && (
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 text-yellow-200 rounded">
          Please connect your wallet. Viewing is restricted to authorized accounts.
        </div>
      )}
      {err && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 text-red-300 rounded">
          {err}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded outline-none focus:border-green-500"
          placeholder="Patient address (0x...)"
          value={patientAddr}
          onChange={(e) => setPatientAddr(e.target.value.trim())}
        />
        <button
          onClick={fetchCases}
          disabled={busy || ctxLoading || !patientAddr}
          className="px-4 py-3 bg-green-500 text-black rounded disabled:opacity-50"
        >
          {busy ? "Loading..." : "Load Cases"}
        </button>
      </div>

      <div className="mb-6">
        <button
          onClick={checkAccess}
          className="text-sm underline text-gray-300"
          disabled={!patientAddr || busy}
        >
          Check if I have been granted access
        </button>
        {access === true && (
          <div className="mt-2 text-green-300 text-sm">✅ Access granted by patient.</div>
        )}
        {access === false && (
          <div className="mt-2 text-red-300 text-sm">
            ⛔ You are not authorized to view this patient&apos;s data.
          </div>
        )}
      </div>

      {/* Cases (only render if access is true) */}
      {access === true && cases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Cases for {shortAddr(patientAddr)}</h3>
            <button
              className="text-sm underline text-gray-300"
              onClick={fetchCases}
              disabled={busy}
            >
              Refresh
            </button>
          </div>
          <ul className="space-y-2">
            {cases.map((c) => (
              <li
                key={c.caseId}
                className="flex items-center justify-between bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]"
              >
                <div>
                  <div className="font-medium">Case #{c.caseId}</div>
                  <div className="text-gray-300">{c.title || <em>(no title)</em>}</div>
                </div>
                <button
                  onClick={() => openCase(c.caseId)}
                  className="px-3 py-2 bg-blue-500 text-black rounded"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Case details (only render if access is true) */}
      {access === true && activeCaseId && (
        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-semibold">Case #{activeCaseId} — Records</h3>
          {records.length === 0 ? (
            <div className="text-gray-400">No records in this case.</div>
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div
                  key={r.recordId}
                  className="bg-[#1A1A1A] p-4 rounded border border-[#2A2A2A]"
                >
                  <div className="text-sm text-gray-400 mb-2">
                    Record #{r.recordId} • Doctor {shortAddr(r.doctor)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div><span className="text-gray-400">Symptoms: </span>{r.symptoms}</div>
                    <div><span className="text-gray-400">Cause: </span>{r.cause}</div>
                    <div><span className="text-gray-400">Inference: </span>{r.inference}</div>
                    <div><span className="text-gray-400">Prescription: </span>{r.prescription}</div>
                    <div><span className="text-gray-400">Advices: </span>{r.advices}</div>
                    <div><span className="text-gray-400">Medications: </span>{r.medications}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-lg font-semibold">Reports (CIDs)</h3>
          {reports.length === 0 ? (
            <div className="text-gray-400">No reports in this case.</div>
          ) : (
            <ul className="list-disc ml-6">
              {reports.map((cid, i) => (
                <li key={i} className="text-gray-200 break-all">
                  {cid}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
